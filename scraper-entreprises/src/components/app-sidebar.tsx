"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Search,
  LayoutDashboard,
  FolderKanban,
  Download,
  Settings,
  Globe,
  Database,
  Zap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const navigation = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Jobs continus", href: "/jobs", icon: Zap, badge: "Nouveau" },
      { title: "Recherche", href: "/recherche", icon: Search, badge: "One-shot" },
      { title: "Entreprises", href: "/entreprises", icon: Building2 },
    ],
  },
  {
    label: "Gestion",
    items: [
      { title: "Campagnes", href: "/campagnes", icon: FolderKanban },
      { title: "Export", href: "/export", icon: Download },
    ],
  },
  {
    label: "Sources",
    items: [
      { title: "API Gouvernement", href: "#", icon: Globe, badge: "Gratuit" },
      { title: "Base de donnees", href: "#", icon: Database, badge: "Local" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Search className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">ScraperPro</span>
                <span className="text-xs text-muted-foreground">
                  Intelligence Commerciale
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs py-0"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Parametres"
              render={<Link href="/parametres" />}
            >
              <Settings className="size-4" />
              <span>Parametres</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
