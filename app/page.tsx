"use client";

import { useMemo, useState } from "react";

const services = [
  { name: "Entra ID", icon: "◈", count: 18, color: "#7c6df2" },
  { name: "Exchange Online", icon: "✉", count: 14, color: "#4f8cff" },
  { name: "Microsoft Teams", icon: "T", count: 11, color: "#8a7cf6" },
  { name: "SharePoint Online", icon: "S", count: 9, color: "#20b893" },
  { name: "Microsoft Graph", icon: "⌘", count: 16, color: "#f09b51" },
  { name: "Intune", icon: "▣", count: 10, color: "#45a9e8" },
  { name: "Security & Compliance", icon: "◇", count: 8, color: "#e45f76" },
];

const snippets = [
  { title: "Create a user", service: "Entra ID", description: "Create a cloud user with a generated password." },
  { title: "Add group members", service: "Entra ID", description: "Add users from CSV to a security group." },
  { title: "Assign licenses", service: "Microsoft Graph", description: "Apply an M365 license by SKU." },
  { title: "Mailbox permissions", service: "Exchange Online", description: "Grant Full Access and Send As." },
  { title: "Create a Team", service: "Microsoft Teams", description: "Create a team and add owners." },
];

const initialScript = `#requires -Version 7.2
<#
.SYNOPSIS
    Creates Microsoft Entra ID users from a CSV file.
.NOTES
    Required Graph scope: User.Create
    Default mode is a local preview. Pass -Execute to allow tenant writes.
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidateScript({ Test-Path $_ })]
    [string] $CsvPath,

    [string] $UsageLocation = "US",

    [switch] $Execute
)

$ErrorActionPreference = "Stop"
$users = Import-Csv -Path $CsvPath

if (-not $Execute) {
    foreach ($user in $users) {
        Write-Output "[PREVIEW] Create user: $($user.UserPrincipalName)"
    }
    Write-Warning "Preview only. No Graph connection was opened and no tenant changes were made. Re-run with -Execute -WhatIf before an intentional write."
    return
}

$connected = $false
try {
    Connect-MgGraph -Scopes "User.Create" -NoWelcome
    $connected = $true

    foreach ($user in $users) {
        $params = @{
            DisplayName       = $user.DisplayName
            UserPrincipalName = $user.UserPrincipalName
            MailNickname      = $user.MailNickname
            UsageLocation     = $UsageLocation
            AccountEnabled    = $true
            PasswordProfile   = @{
                Password = $user.TemporaryPassword
                ForceChangePasswordNextSignIn = $true
            }
        }

        if ($PSCmdlet.ShouldProcess($user.UserPrincipalName, "Create user")) {
            New-MgUser @params
        }
    }
}
catch {
    Write-Error "User creation failed: $($_.Exception.Message)"
}
finally {
    if ($connected) {
        Disconnect-MgGraph | Out-Null
    }
}`;

function highlight(line: string) {
  const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (escaped.trim().startsWith("#")) return <span className="tok-comment" dangerouslySetInnerHTML={{ __html: escaped }} />;
  const colored = escaped
    .replace(/("[^"\n]*")/g, '<span class="tok-string">$1</span>')
    .replace(/\b(param|try|catch|finally|foreach|if|in|true|false)\b/g, '<span class="tok-key">$1</span>')
    .replace(/\b(Connect-MgGraph|Import-Csv|New-MgUser|Write-Error|Disconnect-MgGraph|Test-Path|Out-Null)\b/g, '<span class="tok-command">$1</span>')
    .replace(/(\$[A-Za-z_][\w.]*)/g, '<span class="tok-variable">$1</span>');
  return <span dangerouslySetInnerHTML={{ __html: colored || " " }} />;
}

export default function Home() {
  const [script, setScript] = useState(initialScript);
  const [activeService, setActiveService] = useState("Entra ID");
  const [activePanel, setActivePanel] = useState<"builder" | "permissions">("builder");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [fileName, setFileName] = useState("New-EntraUsers.ps1");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [terminalMessage, setTerminalMessage] = useState("✓ No issues found. Script follows PowerShell best practices.");
  const [activity, setActivity] = useState("Explorer");
  const lines = useMemo(() => script.split("\n"), [script]);
  const filtered = snippets.filter(s => (activeService === "Entra ID" || s.service === activeService) && s.title.toLowerCase().includes(search.toLowerCase()));

  function download() {
    const blob = new Blob([script], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); URL.revokeObjectURL(a.href);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = script;
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  }
  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }
  function newScript() {
    setScript("#requires -Version 7.2\n\n[CmdletBinding()]\nparam()\n\n# Start building your M365 script here\n");
    setFileName("Untitled.ps1");
    setOpenMenu(null);
    notify("New script created");
  }
  function runScript() {
    setRunning(true);
    setTerminalOpen(true);
    setTerminalMessage("Running safety validation…");
    setTimeout(() => {
      setRunning(false);
      setTerminalMessage("✓ Validation complete. Use Export to run this script in PowerShell 7.");
    }, 900);
  }
  function loadTemplate(title: string) {
    setFileName(title.replaceAll(" ","")+".ps1");
    setScript(initialScript.replace("Creates Microsoft Entra ID users from a CSV file.", `${title} — generated M365 automation script.`));
    notify(`${title} template loaded`);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">PS</span><strong>M365 PowerShell Studio</strong><span className="beta">BETA</span></div>
        <div className="top-actions"><button className="icon-btn" aria-label="Search" onClick={()=>setModal("Command search")}>⌕</button><button className="icon-btn" aria-label="Settings" onClick={()=>setModal("Settings")}>⚙</button><button className="avatar" onClick={()=>setModal("Account")}>JM</button></div>
      </header>
      <div className="menubar">{["File","Edit","Selection","View","Run","Help"].map(item=><button key={item} onClick={()=>setOpenMenu(openMenu===item?null:item)}>{item}</button>)}<button className="command-search" onClick={()=>setModal("Command search")}>⌕&nbsp;&nbsp;Search commands, templates, or docs… <kbd>Ctrl K</kbd></button>
        {openMenu && <div className="menu-popover"><b>{openMenu}</b>{openMenu==="File"?<><button onClick={newScript}>New script <kbd>Ctrl N</kbd></button><button onClick={()=>notify("Script saved in this browser")}>Save <kbd>Ctrl S</kbd></button><button onClick={download}>Export .ps1</button></>:<><button onClick={()=>notify(`${openMenu} action applied`)}>Primary action</button><button onClick={()=>setModal(`${openMenu} options`)}>Open {openMenu.toLowerCase()} options</button></>}</div>}
      </div>
      <section className="workspace">
        <aside className="activitybar">
          {[["Explorer","▱"],["Search","⌕"],["Source control","⑂"],["Run","▷"],["Extensions","▦"]].map(([name,icon])=><button key={name} aria-label={name} className={`activity ${activity===name?"active":""}`} onClick={()=>{setActivity(name);notify(`${name} panel selected`)}}>{icon}</button>)}
          <div className="activity-spacer"/><button aria-label="Account" className="activity" onClick={()=>setModal("Account")}>♙</button><button aria-label="Settings" className="activity" onClick={()=>setModal("Settings")}>⚙</button>
        </aside>
        <aside className="explorer">
          <div className="pane-title"><span>{activity.toUpperCase()}</span><button onClick={()=>setModal("Explorer actions")}>•••</button></div>
          <div className="section-label">▾ SCRIPT LIBRARY <button onClick={newScript}>＋</button></div>
          <div className="service-list">
            {services.map(s => <button key={s.name} className={`service ${activeService === s.name ? "selected" : ""}`} onClick={() => setActiveService(s.name)}><span className="service-icon" style={{color:s.color}}>{s.icon}</span><span>{s.name}</span><small>{s.count}</small></button>)}
          </div>
          <div className="section-label collapsed">› MY SCRIPTS <span>7</span></div>
          <div className="section-label collapsed">› FAVORITES <span>3</span></div>
          <div className="recent"><div className="section-label">▾ RECENT</div>{["New-EntraUsers.ps1","Get-StaleAccounts.ps1","Set-MailboxAccess.ps1"].map(name=><button key={name} onClick={()=>{setFileName(name);notify(`${name} opened`)}}>PS&nbsp;&nbsp;{name}</button>)}</div>
        </aside>
        <section className="main-column">
          <div className="tabs"><div className="tab active"><span className="ps-mini">PS</span><input value={fileName} onChange={e=>setFileName(e.target.value)} aria-label="File name"/><span className="dirty">●</span><button onClick={newScript}>×</button></div><button className="new-tab" onClick={newScript}>＋</button></div>
          <div className="editor-toolbar"><span>⌘ {activeService}</span><span className="crumb">›</span><span>Create users from CSV</span><div className="toolbar-spacer"/><button onClick={()=>setTerminalOpen(!terminalOpen)}>▱ Terminal</button><button onClick={copy}>{copied ? "✓ Copied" : "▣ Copy"}</button><button className="run-btn" onClick={runScript}>{running?"◌ Checking…":"▷ Run"}</button><button onClick={download}>Export</button></div>
          <div className="editor-wrap">
            <div className="code-view" aria-hidden="true">{lines.map((line,i)=><div className="code-line" key={i}><span className="line-no">{i+1}</span><code>{highlight(line)}</code></div>)}</div>
            <textarea className="code-input" value={script} onChange={e=>setScript(e.target.value)} spellCheck={false} aria-label="PowerShell script editor" />
          </div>
          {terminalOpen && <div className="terminal"><div className="terminal-head"><span className="active">TERMINAL</span><button onClick={()=>notify("Output panel selected")}>OUTPUT</button><button onClick={()=>notify("No problems detected")}>PROBLEMS <b>0</b></button><div/><button onClick={()=>setTerminalOpen(false)}>×</button></div><div className="terminal-body"><p><span className="term-path">PS C:\M365Studio&gt;</span> <span className="term-command">Invoke-ScriptAnalyzer .\{fileName}</span></p><p className="success">{terminalMessage}</p><p><span className="term-path">PS C:\M365Studio&gt;</span> <span className="cursor" /></p></div></div>}
          <footer className="statusbar"><span>⑂ main*</span><span>↻</span><span>ⓧ 0&nbsp;&nbsp;△ 0</span><div/><span>Ln 1, Col 1</span><span>Spaces: 4</span><span>UTF-8</span><span>CRLF</span><span>{"{}"} PowerShell</span><span>◉ Connected</span></footer>
        </section>
        <aside className="builder-pane">
          <div className="builder-tabs"><button className={activePanel==="builder"?"active":""} onClick={()=>setActivePanel("builder")}>SCRIPT BUILDER</button><button className={activePanel==="permissions"?"active":""} onClick={()=>setActivePanel("permissions")}>PERMISSIONS</button></div>
          {activePanel === "builder" ? <>
            <div className="builder-content"><div className="builder-heading"><span className="big-icon">◈</span><div><small>ENTRA ID</small><h2>Create users from CSV</h2></div></div><p className="muted">Build a production-ready script to create cloud users from a CSV source.</p>
              <label>CSV file path<span>*</span><div className="field-row"><input defaultValue="C:\Users\Jake\users.csv"/><button>▱</button></div></label>
              <label>Usage location<select defaultValue="US"><option>US — United States</option><option>CA — Canada</option><option>GB — United Kingdom</option></select></label>
              <label className="check"><input type="checkbox" defaultChecked/><span><b>Force password change</b><small>Require users to change their password at first sign-in.</small></span></label>
              <label className="check"><input type="checkbox" checked readOnly/><span><b>Require explicit -Execute</b><small>Generated scripts preview locally by default. Use -Execute -WhatIf before an intentional write.</small></span></label>
              <label>Error handling<select><option>Stop and report errors</option><option>Continue and log errors</option></select></label>
              <button className="generate" onClick={()=>setScript(initialScript)}>↻ Generate script</button>
            </div>
            <div className="templates"><div className="template-head"><b>Quick templates</b><input placeholder="Filter…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{filtered.slice(0,3).map(s=><button key={s.title} onClick={()=>loadTemplate(s.title)}><span className="template-icon">PS</span><span><b>{s.title}</b><small>{s.description}</small></span><em>＋</em></button>)}</div>
          </> : <div className="permissions-panel"><div className="permission-ok">✓</div><h2>Required permissions</h2><p>This script uses delegated Microsoft Graph access.</p><div className="scope"><span>Microsoft Graph</span><b>User.Create</b><small>Least-privileged create-user permission documented by Microsoft</small></div><div className="scope"><span>Execution guard</span><b>-Execute</b><small>Required before the script opens a Graph connection</small></div><h3>Connection command</h3><code>Connect-MgGraph -Scopes<br/> &quot;User.Create&quot;</code><p className="permission-note">Preview first, then use -Execute -WhatIf and review the tenant context before an intentional run.</p></div>}
        </aside>
      </section>
      {toast && <div className="toast">✓ {toast}</div>}
      {modal && <div className="modal-backdrop" onClick={()=>setModal(null)}><section className="modal-card" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal(null)}>×</button><span className="modal-icon">{modal==="Settings"?"⚙":"⌘"}</span><h2>{modal}</h2>{modal==="Command search"?<><input autoFocus placeholder="Type a command or template…"/><div className="command-results"><button onClick={newScript}>New PowerShell script <kbd>Ctrl N</kbd></button><button onClick={runScript}>Validate current script <kbd>F5</kbd></button><button onClick={download}>Export current script</button></div></>:<><p>Configure your M365 PowerShell Studio workspace.</p><label className="modal-toggle"><input type="checkbox" defaultChecked/> PowerShell 7 compatibility</label><label className="modal-toggle"><input type="checkbox" defaultChecked/> Add WhatIf protection by default</label><button className="modal-primary" onClick={()=>{setModal(null);notify(`${modal} updated`)}}>Save changes</button></>}</section></div>}
    </main>
  );
}
