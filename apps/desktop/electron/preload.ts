import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'

// Which translucency the OS can back. Asked synchronously because the renderer
// needs it before its first paint, and answered by main because deciding it
// needs `os.release()` — a sandboxed preload may only require electron, events,
// timers and url, so importing node:os here throws before contextBridge runs
// and takes the ENTIRE bridge down with it (window.umbrielDesktop undefined =>
// "Desktop IPC bridge is unavailable"). No reply means no glass, which degrades
// to an ordinary opaque window rather than a page thinned over nothing.
const translucencySupport = ipcRenderer.sendSync('umbriel:translucency:support')
const hudWindowing = ipcRenderer.sendSync('umbriel:hud:windowing')
const hudNativeDrag = hudWindowing?.nativeDrag === true

contextBridge.exposeInMainWorld('umbrielDesktop', {
  glassSupported: translucencySupport?.glass === true,
  translucencySupported: translucencySupport?.translucency === true,
  getConnection: profile => ipcRenderer.invoke('umbriel:connection', profile),
  // Registry-scoped backend resolution: { connectionId, profile } → descriptor.
  getConnectionFor: payload => ipcRenderer.invoke('umbriel:connection:for', payload),
  getProfileRoutes: profiles => ipcRenderer.invoke('umbriel:plugin-profile-routes', profiles),
  revalidateConnection: () => ipcRenderer.invoke('umbriel:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('umbriel:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('umbriel:gateway:ws-url', profile),
  // Registry-scoped fresh WS URL: { connectionId, profile } → result shape of
  // getGatewayWsUrl, minted against that connection's backend.
  getGatewayWsUrlFor: payload => ipcRenderer.invoke('umbriel:gateway:ws-url-for', payload),
  // Union agent roster across every registered connection.
  getAgentRoster: () => ipcRenderer.invoke('umbriel:agents:roster'),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('umbriel:window:openSession', sessionId, opts),
  openSessionInTerminal: (sessionId, opts) => ipcRenderer.invoke('umbriel:window:openInTerminal', sessionId, opts),
  openWindow: () => ipcRenderer.invoke('umbriel:window:openInstance'),
  openBrowserWindow: tabId => ipcRenderer.invoke('umbriel:window:openBrowser', tabId),
  onBrowserPopoutClosed: callback => {
    const listener = (_event, tabId) => callback(tabId)
    ipcRenderer.on('umbriel:browser-popout:closed', listener)

    return () => ipcRenderer.removeListener('umbriel:browser-popout:closed', listener)
  },
  claimAmbientCue: key => ipcRenderer.invoke('umbriel:ambient:claim', key),
  wakeIndicator: {
    getState: () => ipcRenderer.invoke('umbriel:wake-indicator:get'),
    setState: state => ipcRenderer.send('umbriel:wake-indicator:set', state),
    onState: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('umbriel:wake-indicator:state', listener)

      return () => ipcRenderer.removeListener('umbriel:wake-indicator:state', listener)
    }
  },
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('umbriel:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('umbriel:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('umbriel:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('umbriel:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('umbriel:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('umbriel:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('umbriel:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('umbriel:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('umbriel:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('umbriel:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('umbriel:pet-overlay:control', listener)
    }
  },
  // HUD mode: the chrome-free floating chat. A full app renderer (own gateway)
  // sized as a floating bar, so it mounts the real composer. Main owns the
  // window; `onChanged` keeps every window's toggle truthful.
  hud: {
    nativeDrag: hudNativeDrag,
    windowing: {
      clientPlacement: hudWindowing?.clientPlacement !== false,
      controlDrag: hudWindowing?.controlDrag === true,
      nativeDrag: hudNativeDrag,
      solid: hudWindowing?.solid === true,
      workspaceTransfer: hudWindowing?.workspaceTransfer === true
    },
    open: request => ipcRenderer.invoke('umbriel:hud:open', request),
    close: () => ipcRenderer.invoke('umbriel:hud:close'),
    setIgnoreMouse: ignore => ipcRenderer.send('umbriel:hud:ignore-mouse', ignore),
    beginMove: () => ipcRenderer.send('umbriel:hud:begin-move'),
    endMove: () => ipcRenderer.send('umbriel:hud:end-move'),
    moveBy: delta => ipcRenderer.send('umbriel:hud:move-by', delta),
    setWorkspaceTransfer: transferring => ipcRenderer.send('umbriel:hud:workspace-transfer', transferring),
    setBounds: bounds => ipcRenderer.send('umbriel:hud:set-bounds', bounds),
    resetLayout: () => ipcRenderer.invoke('umbriel:hud:reset-layout'),
    // Whether the band covers the window below the bar. Main pairs it with the
    // user's translucency setting to decide the native frost (macOS vibrancy /
    // Windows 11 DWM backdrop) — see hudFrostFor.
    setFrost: showing => ipcRenderer.invoke('umbriel:hud:frost', showing),
    // The HUD tells main which session it is on; main hands that back to the
    // app window when the HUD closes, so the app can re-home onto it.
    setSession: sessionId => ipcRenderer.send('umbriel:hud:session', sessionId),
    onGoto: callback => {
      const listener = (_event, sessionId) => callback(sessionId)
      ipcRenderer.on('umbriel:hud:goto', listener)

      return () => ipcRenderer.removeListener('umbriel:hud:goto', listener)
    },
    onChanged: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('umbriel:hud:changed', listener)

      return () => ipcRenderer.removeListener('umbriel:hud:changed', listener)
    },
    // Linux only, and silent elsewhere: where the cursor is, in page
    // coordinates, or null when it has left the window. Stands in for the
    // mousemove that `setIgnoreMouseEvents(true, { forward: true })` delivers on
    // macOS and Windows but not here.
    onCursor: callback => {
      const listener = (_event, point) => callback(point)
      ipcRenderer.on('umbriel:hud:cursor', listener)

      return () => ipcRenderer.removeListener('umbriel:hud:cursor', listener)
    },
    // Main's game-overlay watch: whether a fullscreen app (a game) is under
    // the HUD, so the renderer can step back to the low-opacity overlay
    // treatment while one owns the screen.
    onGameOverlay: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('umbriel:hud:game-overlay', listener)

      return () => ipcRenderer.removeListener('umbriel:hud:game-overlay', listener)
    }
  },
  // Quick Entry: the global-hotkey mini composer window. Main owns the OS
  // shortcut + the persisted preference; the quick window only captures text
  // and hands it back, and the primary renderer submits it through the normal
  // prompt path.
  quickEntry: {
    getSettings: () => ipcRenderer.invoke('umbriel:quick-entry:settings:get'),
    setSettings: patch => ipcRenderer.invoke('umbriel:quick-entry:settings:set', patch),
    submit: payload => ipcRenderer.send('umbriel:quick-entry:submit', payload),
    dismiss: () => ipcRenderer.send('umbriel:quick-entry:dismiss'),
    // Primary renderer → main → quick window: gateway connection state + the
    // recent-session options the target picker offers. Main caches the latest
    // payload so a freshly spawned quick window starts from truth.
    pushState: payload => ipcRenderer.send('umbriel:quick-entry:state', payload),
    // Quick window subscribes to those pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('umbriel:quick-entry:state', listener)

      return () => ipcRenderer.removeListener('umbriel:quick-entry:state', listener)
    },
    // Main → primary renderer: a submit captured by the quick window.
    onSubmit: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('umbriel:quick-entry:submit', listener)

      return () => ipcRenderer.removeListener('umbriel:quick-entry:submit', listener)
    },
    // Main → quick window: you were just summoned (reset draft + refocus).
    onShown: callback => {
      const listener = () => callback()
      ipcRenderer.on('umbriel:quick-entry:shown', listener)

      return () => ipcRenderer.removeListener('umbriel:quick-entry:shown', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('umbriel:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('umbriel:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('umbriel:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('umbriel:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('umbriel:connection-config:test', payload),
  // Opt-in OS-keychain encryption for stored gateway secrets (default off —
  // see secret-storage-policy.ts). get never touches the OS keychain.
  getSecretStorageEncryption: () => ipcRenderer.invoke('umbriel:secret-storage:get'),
  setSecretStorageEncryption: (on: boolean) => ipcRenderer.invoke('umbriel:secret-storage:set', on),
  // v2 multi-connection registry: named agent sources (local / remote / cloud / ssh).
  connections: {
    list: () => ipcRenderer.invoke('umbriel:connections:list'),
    save: payload => ipcRenderer.invoke('umbriel:connections:save', payload),
    remove: id => ipcRenderer.invoke('umbriel:connections:remove', id),
    setPrimary: id => ipcRenderer.invoke('umbriel:connections:set-primary', id),
    setLaunchMode: mode => ipcRenderer.invoke('umbriel:connections:set-launch-mode', mode),
    setLastUsed: id => ipcRenderer.invoke('umbriel:connections:set-last-used', id),
    test: id => ipcRenderer.invoke('umbriel:connections:test', id),
    updateManaged: id => ipcRenderer.invoke('umbriel:connections:update-managed', id),
    // Fan out `umbriel update` to every eligible registered connection.
    // Optional excludeIds skips rows the caller updates through another path.
    updateAll: options => ipcRenderer.invoke('umbriel:connections:update-all', options),
    // Registry lifecycle push (main → renderer): a connection was removed or
    // materially edited, so secondaries scoped to it must be disposed (and,
    // for edits, re-dialed at the new target).
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('umbriel:connections:changed', listener)

      return () => ipcRenderer.removeListener('umbriel:connections:changed', listener)
    }
  },
  sshConfigHosts: () => ipcRenderer.invoke('umbriel:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('umbriel:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('umbriel:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('umbriel:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('umbriel:connection-config:oauth-logout', remoteUrl),
  // Umbriel Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('umbriel:cloud:status'),
    login: () => ipcRenderer.invoke('umbriel:cloud:login'),
    logout: () => ipcRenderer.invoke('umbriel:cloud:logout'),
    discover: org => ipcRenderer.invoke('umbriel:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('umbriel:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    get: () => ipcRenderer.invoke('umbriel:profile:get'),
    remember: name => ipcRenderer.invoke('umbriel:profile:remember', name),
    set: name => ipcRenderer.invoke('umbriel:profile:set', name)
  },
  api: request => ipcRenderer.invoke('umbriel:api', request),
  notify: payload => ipcRenderer.invoke('umbriel:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('umbriel:requestMicrophoneAccess'),
  readWindowBelow: () => ipcRenderer.invoke('umbriel:window:readBelow'),
  readFileDataUrl: filePath => ipcRenderer.invoke('umbriel:readFileDataUrl', filePath),
  readFileDataUrlForAttach: filePath => ipcRenderer.invoke('umbriel:readFileDataUrlForAttach', filePath),
  dataUrlReadMax: {
    get: () => ipcRenderer.invoke('umbriel:data-url-read-max:get'),
    set: maxMb => ipcRenderer.invoke('umbriel:data-url-read-max:set', maxMb)
  },
  readFileText: filePath => ipcRenderer.invoke('umbriel:readFileText', filePath),
  readPluginSource: (filePath: string) => ipcRenderer.invoke('umbriel:readPluginSource', filePath),
  selectPaths: options => ipcRenderer.invoke('umbriel:selectPaths', options),
  selectSavePath: options => ipcRenderer.invoke('umbriel:selectSavePath', options),
  writeClipboard: text => ipcRenderer.invoke('umbriel:writeClipboard', text),
  readClipboard: () => ipcRenderer.invoke('umbriel:readClipboard'),
  saveGatewayFile: payload => ipcRenderer.invoke('umbriel:saveGatewayFile', payload),
  saveImageFromUrl: url => ipcRenderer.invoke('umbriel:saveImageFromUrl', url),
  contextMenuEdit: command => ipcRenderer.invoke('umbriel:context-menu:edit', command),
  contextMenuCopyImage: () => ipcRenderer.invoke('umbriel:context-menu:copy-image'),
  contextMenuSpellcheck: action => ipcRenderer.invoke('umbriel:context-menu:spellcheck', action),
  contextMenuGuestAddWord: payload => ipcRenderer.invoke('umbriel:context-menu:guest-add-word', payload),
  onContextMenuSpellcheck: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:context-menu-spellcheck', listener)

    return () => ipcRenderer.removeListener('umbriel:context-menu-spellcheck', listener)
  },
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('umbriel:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('umbriel:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('umbriel:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('umbriel:watchPreviewFile', url),
  watchDirectory: dir => ipcRenderer.invoke('umbriel:watchDirectory', dir),
  stopPreviewFileWatch: id => ipcRenderer.invoke('umbriel:stopPreviewFileWatch', id),
  setActiveWork: payload => ipcRenderer.send('umbriel:active-work', payload),
  setTitleBarTheme: payload => ipcRenderer.send('umbriel:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('umbriel:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('umbriel:translucency', payload),
  setKeepAwake: on => ipcRenderer.send('umbriel:keep-awake', on),
  setDisableF12: blocked => ipcRenderer.send('umbriel:devtools:disable-f12', blocked),
  setPreviewShortcutActive: active => ipcRenderer.send('umbriel:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('umbriel:openExternal', url),
  mcpOauth: {
    // One-shot loopback listener for MCP OAuth against remote backends: bind
    // on this machine, hand redirectUri to mcp.servers.oauth.start, then wait
    // for the provider redirect and relay code/state via oauth.callback.
    listen: () => ipcRenderer.invoke('umbriel:mcp-oauth:listen'),
    wait: (id, timeoutMs) => ipcRenderer.invoke('umbriel:mcp-oauth:wait', id, timeoutMs),
    cancel: id => ipcRenderer.invoke('umbriel:mcp-oauth:cancel', id)
  },
  openPreviewInBrowser: url => ipcRenderer.invoke('umbriel:openPreviewInBrowser', url),
  reachPreviewUrl: url => ipcRenderer.invoke('umbriel:preview:reach', url),
  setActiveConnectionRoute: route => ipcRenderer.send('umbriel:connection:active-route', route),
  fetchLinkTitle: url => ipcRenderer.invoke('umbriel:fetchLinkTitle', url),
  resolveFavicon: url => ipcRenderer.invoke('umbriel:resolveFavicon', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('umbriel:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('umbriel:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('umbriel:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('umbriel:setting:defaultProjectDir:pick')
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('umbriel:zoom:get'),
    // Synchronous zoom factor (1 = 100%). Coordinate math needs it in the
    // same tick as the event it converts, so no IPC round-trip here.
    factor: () => webFrame.getZoomFactor(),
    setPercent: percent => ipcRenderer.send('umbriel:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('umbriel:zoom:changed', listener)

      return () => ipcRenderer.removeListener('umbriel:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('umbriel:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('umbriel:logs:recent'),
  // Fire-and-forget: persists a renderer error-boundary catch (with component
  // stack) to desktop.log so crashes survive the window (#79428).
  reportRendererError: report => ipcRenderer.send('umbriel:logs:renderer-error', report),
  readDir: dirPath => ipcRenderer.invoke('umbriel:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('umbriel:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('umbriel:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('umbriel:fs:openDir', dirPath),
  desktopPluginsRoot: () => ipcRenderer.invoke('umbriel:fs:desktopPluginsRoot'),
  logsRoot: () => ipcRenderer.invoke('umbriel:fs:logsRoot'),
  agentPluginsRoot: () => ipcRenderer.invoke('umbriel:fs:agentPluginsRoot'),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('umbriel:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('umbriel:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('umbriel:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('umbriel:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('umbriel:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('umbriel:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('umbriel:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('umbriel:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('umbriel:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('umbriel:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('umbriel:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('umbriel:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('umbriel:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('umbriel:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('umbriel:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('umbriel:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('umbriel:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('umbriel:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('umbriel:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('umbriel:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('umbriel:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('umbriel:git:review:shipInfo', repoPath),
      prList: (repoPath, branches, numbers) =>
        ipcRenderer.invoke('umbriel:git:review:prList', repoPath, branches, numbers),
      fetchPrComment: (repoPath, url) => ipcRenderer.invoke('umbriel:git:review:fetchPrComment', repoPath, url),
      createPr: repoPath => ipcRenderer.invoke('umbriel:git:review:createPr', repoPath)
    }
  },
  terminal: {
    cwd: id => ipcRenderer.invoke('umbriel:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('umbriel:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('umbriel:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('umbriel:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('umbriel:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `umbriel:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `umbriel:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('umbriel:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('umbriel:close-preview-requested', listener)
  },
  onPreviewNav: callback => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('umbriel:preview-nav', listener)

    return () => ipcRenderer.removeListener('umbriel:preview-nav', listener)
  },
  onOpenFolderRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('umbriel:open-folder-requested', listener)

    return () => ipcRenderer.removeListener('umbriel:open-folder-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('umbriel:open-updates', listener)

    return () => ipcRenderer.removeListener('umbriel:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:deep-link', listener)

    return () => ipcRenderer.removeListener('umbriel:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('umbriel:deep-link-ready'),
  probePluginRepo: payload => ipcRenderer.invoke('umbriel:plugin:probe', payload),
  installDesktopPlugin: payload => ipcRenderer.invoke('umbriel:plugin:installDesktop', payload),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:window-state-changed', listener)

    return () => ipcRenderer.removeListener('umbriel:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('umbriel:focus-session', listener)

    return () => ipcRenderer.removeListener('umbriel:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:notification-action', listener)

    return () => ipcRenderer.removeListener('umbriel:notification-action', listener)
  },
  onNotificationActivate: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:notification-activate', listener)

    return () => ipcRenderer.removeListener('umbriel:notification-activate', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('umbriel:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:backend-exit', listener)

    return () => ipcRenderer.removeListener('umbriel:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('umbriel:connection:applied', listener)

    return () => ipcRenderer.removeListener('umbriel:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('umbriel:power-resume', listener)

    return () => ipcRenderer.removeListener('umbriel:power-resume', listener)
  },
  // AC ↔ battery transitions; renderers slow their backstop polls on battery.
  getOnBattery: () => ipcRenderer.invoke('umbriel:power-battery:get'),
  onBatteryChanged: callback => {
    const listener = (_event, onBattery) => callback(Boolean(onBattery))
    ipcRenderer.on('umbriel:power-battery', listener)

    return () => ipcRenderer.removeListener('umbriel:power-battery', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:boot-progress', listener)

    return () => ipcRenderer.removeListener('umbriel:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('umbriel:bootstrap:get'),
  continueBootstrapLocal: () => ipcRenderer.invoke('umbriel:bootstrap:continue-local'),
  resetBootstrap: () => ipcRenderer.invoke('umbriel:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('umbriel:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('umbriel:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('umbriel:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('umbriel:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('umbriel:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('umbriel:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('umbriel:uninstall:summary'),
    run: mode => ipcRenderer.invoke('umbriel:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('umbriel:updates:check'),
    apply: opts => ipcRenderer.invoke('umbriel:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('umbriel:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('umbriel:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('umbriel:updates:progress', listener)

      return () => ipcRenderer.removeListener('umbriel:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('umbriel:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('umbriel:vscode-theme:search', query)
  },
  // Find-in-page (Ctrl/Cmd+F): delegates to Electron's
  // webContents.findInPage on the IPC sender's window so a Cmd+F pressed
  // in a secondary session window searches THAT window, not the primary.
  // `onFoundInPage` returns the unsubscribe fn; the renderer wires it via
  // `initFindInPageListener` in store/find-in-page.ts and tears it down
  // when the FindBar unmounts.
  findInPage: (query, options) => ipcRenderer.invoke('umbriel:find-in-page', query, options),
  stopFindInPage: () => ipcRenderer.invoke('umbriel:stop-find-in-page'),
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('umbriel:found-in-page', listener)

    return () => ipcRenderer.removeListener('umbriel:found-in-page', listener)
  },
  // Main-process `before-input-event` forwards Ctrl/Cmd+F here so renderer
  // can open the FindBar even when the GTK compositor has already grabbed
  // the chord at the windowing layer (#81727).
  onOpenFindBarRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('umbriel:open-find-bar', listener)

    return () => ipcRenderer.removeListener('umbriel:open-find-bar', listener)
  }
})
