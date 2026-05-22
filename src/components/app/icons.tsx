"use client";

import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock3,
  Crown,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

import type { IconName } from "@/lib/navigation";

export const iconMap = {
  LayoutDashboard,
  CheckSquare,
  Users,
  FolderKanban,
  CalendarDays,
  Clock3,
  Megaphone,
  Trophy,
  Bell,
  Shield,
  Settings,
  KeyRound,
  Sparkles,
  UserPlus,
  CalendarCheck,
  ChevronDown,
  Crown,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Zap,
} as const;

export function AppIcon({ name, className }: { name: IconName | keyof typeof iconMap; className?: string }) {
  const Icon = iconMap[name];
  return <Icon className={className} />;
}
