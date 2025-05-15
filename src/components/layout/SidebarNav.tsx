
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Settings, Trophy, ShieldAlert } from "lucide-react"; 
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean; // True if only 'Admin' can see
  ownerOrAdmin?: boolean; // True if 'Owner' or 'Admin' can see
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/admin/tournaments", label: "Manage Tournaments", icon: Trophy, ownerOrAdmin: true },
  { href: "/admin/players", label: "Manage Players", icon: Users, ownerOrAdmin: true },
  { href: "/admin/users", label: "Manage Users", icon: ShieldAlert, adminOnly: true },
  // Example of a settings link if needed in future
  // { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarNavProps {
  isMobile?: boolean; // To adjust styling or behavior if needed for mobile
}

export default function SidebarNav({ isMobile = false }: SidebarNavProps) {
  const pathname = usePathname();
  const { currentUserDetails } = useAuth();

  return (
    <nav className={cn(
      "flex flex-col gap-2 text-sm font-medium",
      isMobile ? "p-4" : "px-2 py-4"
    )}>
      {navItems.map((item) => {
        if (item.adminOnly && currentUserDetails?.accountType !== 'Admin') {
          return null;
        }
        if (item.ownerOrAdmin && !['Admin', 'Owner'].includes(currentUserDetails?.accountType || '')) {
          return null;
        }
        
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary hover:bg-muted",
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) // Highlight parent nav item
                ? "bg-muted text-primary"
                : "text-muted-foreground",
              isMobile ? "text-base" : ""
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

