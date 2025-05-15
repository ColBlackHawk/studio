
"use client";

import Link from "next/link";
import { Menu, LogIn, LogOut } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { APP_NAME } from "@/lib/constants";
import SidebarNav from "./SidebarNav"; 
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export default function Header() {
  const { currentUserEmail, currentUserDetails, logout, isLoading } = useAuth();

  const getInitials = () => {
    if (currentUserDetails?.nickname) {
      return currentUserDetails.nickname.substring(0, 2).toUpperCase();
    }
    if (currentUserDetails) {
      const first = currentUserDetails.firstName?.[0] || '';
      const last = currentUserDetails.lastName?.[0] || '';
      if (first && last) return `${first}${last}`.toUpperCase();
      if (first) return first.toUpperCase();
      if (last) return last.toUpperCase();
    }
    if (currentUserEmail) {
      return currentUserEmail.substring(0, 2).toUpperCase();
    }
    return "?";
  };

  const getDisplayName = () => {
    if (currentUserDetails?.nickname) {
      return currentUserDetails.nickname;
    }
    if (currentUserDetails?.firstName && currentUserDetails?.lastName) {
      return `${currentUserDetails.firstName} ${currentUserDetails.lastName}`;
    }
    if (currentUserDetails?.firstName) {
      return currentUserDetails.firstName;
    }
    if (currentUserDetails?.lastName) {
      return currentUserDetails.lastName;
    }
    return currentUserEmail || "User";
  }


  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex w-full items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold md:text-base">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
             <path d="M12 22V12"></path>
             <path d="M20 12v5.5"></path>
             <path d="M4 12v5.5"></path>
          </svg>
          <span className="font-bold text-xl text-primary">{APP_NAME}</span>
        </Link>
        
        <div className="flex items-center gap-3">
          {isLoading ? (
            <Button variant="ghost" size="sm" disabled>Loading...</Button>
          ) : currentUserEmail ? (
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    {/* Future: <AvatarImage src={currentUserDetails?.avatarUrl} alt={getDisplayName()} /> */}
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {getDisplayName()}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {currentUserEmail}
                    </p>
                     {currentUserDetails?.accountType && (
                       <p className="text-xs leading-none text-muted-foreground/80 capitalize pt-1">
                         Account Type: {currentUserDetails.accountType}
                       </p>
                     )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Link>
            </Button>
          )}

          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <div className="p-4 border-b">
                  <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                      <path d="M2 17l10 5 10-5"></path>
                      <path d="M2 12l10 5 10-5"></path>
                      <path d="M12 22V12"></path>
                      <path d="M20 12v5.5"></path>
                      <path d="M4 12v5.5"></path>
                    </svg>
                    <span className="font-bold text-xl text-primary">{APP_NAME}</span>
                  </Link>
                </div>
                <SidebarNav isMobile={true} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

