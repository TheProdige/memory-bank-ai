/**
 * App Layout with Professional Sidebar Navigation
 * Responsive layout with collapsible sidebar and routing
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  FileText,
  Settings,
  BarChart3,
  Mic,
  Search,
  Bell,
  User,
  LogOut,
  Menu,
  Brain,
  Zap,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore, selectNotifications } from '@/core/state/AppStore';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Logger } from '@/core/logging/Logger';

const navigationItems = [
  {
    title: 'Tableau de bord',
    url: '/dashboard',
    icon: Home,
    description: 'Vue d\'ensemble de vos mémoires',
  },
  {
    title: 'Mémoires',
    url: '/memories',
    icon: FileText,
    description: 'Parcourir et gérer vos mémoires',
  },
  {
    title: 'Enregistrer',
    url: '/dashboard?action=record',
    icon: Mic,
    description: 'Créer une nouvelle mémoire vocale',
  },
];

const analyticsItems = [
  {
    title: 'Statistiques',
    url: '/settings#analytics',
    icon: BarChart3,
    description: 'Analyses et métriques d\'utilisation',
  },
];

const settingsItems = [
  {
    title: 'Paramètres',
    url: '/settings',
    icon: Settings,
    description: 'Configuration de l\'application',
  },
];

const AppSidebar: React.FC = () => {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/dashboard' && currentPath === '/dashboard') return true;
    if (path !== '/dashboard' && currentPath.startsWith(path)) return true;
    return false;
  };

  const getNavClasses = (path: string) => {
    return isActive(path)
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "hover:bg-sidebar-accent/50";
  };

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b p-4">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          {state !== "collapsed" && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="font-bold text-lg">EchoVault</h1>
              <p className="text-xs text-muted-foreground">AI Memory Bank</p>
            </motion.div>
          )}
        </motion.div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClasses(item.url)}
                      title={item.description}
                    >
                      <item.icon className="w-4 h-4" />
                      {state !== "collapsed" && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Analytics */}
        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClasses(item.url)}
                      title={item.description}
                    >
                      <item.icon className="w-4 h-4" />
                      {state !== "collapsed" && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClasses(item.url)}
                      title={item.description}
                    >
                      <item.icon className="w-4 h-4" />
                      {state !== "collapsed" && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

const AppHeader: React.FC = () => {
  const { user, signOut } = useAuth();
  const notifications = useAppStore(selectNotifications);
  const { toggleCommandPalette } = useAppStore();

  const handleSignOut = async () => {
    await signOut();
    Logger.logUserAction('sign_out');
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCommandPalette}
              className="relative"
            >
              <Search className="w-4 h-4 mr-2" />
              Rechercher...
              <Badge variant="secondary" className="ml-2 text-xs">
                ⌘K
              </Badge>
            </Button>
          </motion.div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs"
              >
                {notifications.length}
              </Badge>
            )}
          </Button>

          {/* Performance Indicator */}
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-500 font-medium">Optimal</span>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback>
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.user_metadata?.display_name || 'Utilisateur'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/settings" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profil</span>
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavLink to="/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Paramètres</span>
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />
          <main 
            id="main-content"
            className="flex-1 overflow-y-auto bg-background"
          >
            <motion.div
              className="container mx-auto p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
      <NotificationCenter />
    </SidebarProvider>
  );
};