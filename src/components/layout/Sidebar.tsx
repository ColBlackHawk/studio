import SidebarNav from "./SidebarNav";

export default function Sidebar() {
  return (
    <aside className="hidden border-r bg-card md:block md:w-64 lg:w-72">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex-1">
          <SidebarNav />
        </div>
        {/* Optional: Add a footer to the sidebar if needed */}
        {/* <div className="mt-auto p-4">
          <p className="text-xs text-muted-foreground">&copy; 2024 BracketBoard</p>
        </div> */}
      </div>
    </aside>
  );
}