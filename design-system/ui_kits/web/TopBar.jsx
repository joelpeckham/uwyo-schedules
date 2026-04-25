// Top navigation bar with logo, nav links, and user menu.
function TopBar({ user = "Jordan P." }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#">
          <span className="brand-mark">u</span>
          <span className="brand-word">uwyo<span className="accent">Schedules</span></span>
        </a>
        <nav className="topnav">
          <a className="topnav-link active" href="#">Schedules</a>
          <a className="topnav-link" href="#">Courses</a>
          <a className="topnav-link" href="#">Saved</a>
          <a className="topnav-link" href="#">Help</a>
        </nav>
        <div className="topbar-end">
          <button className="icon-btn" aria-label="Search"><i data-lucide="search"></i></button>
          <button className="icon-btn" aria-label="Settings"><i data-lucide="settings-2"></i></button>
          <button className="user-chip">
            <span className="user-avatar">{user.split(" ").map(s => s[0]).join("")}</span>
            <span className="user-name">{user}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

window.TopBar = TopBar;
