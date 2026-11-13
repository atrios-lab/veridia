import {
  ArrowLeft,
  Calculator,
  Calendar,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Inbox,
  LayoutGrid,
  Lock,
  type LucideIcon,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Play,
  Plus,
  Printer,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  Users,
  Wrench,
  X,
} from "lucide-react";

// The panel's icons by name. Drawn by lucide, the set the components in
// ../_ui use, so a screen never mixes two strokes (painel-neutro-shadcn).
// Private to the panel: the public site keeps its own small set in
// (public)/_components/icon.tsx, so the two change independently.
const ICONS = {
  eye: Eye,
  eyeOff: EyeOff,
  check: Check,
  clock: Clock,
  grid: LayoutGrid,
  settings: Settings,
  lock: Lock,
  upload: Upload,
  chevronDown: ChevronDown,
  arrowLeft: ArrowLeft,
  menu: Menu,
  inbox: Inbox,
  file: FileText,
  globe: Globe,
  chat: MessageSquare,
  x: X,
  mail: Mail,
  calendar: Calendar,
  megaphone: Megaphone,
  shield: Shield,
  users: Users,
  search: Search,
  plus: Plus,
  checkCircle: CircleCheck,
  printer: Printer,
  copy: Copy,
  clipboard: ClipboardList,
  calculator: Calculator,
  trash: Trash2,
  play: Play,
  alert: CircleAlert,
  wrench: Wrench,
} satisfies Record<string, LucideIcon>;

export type AdminIconName = keyof typeof ICONS;

export function AdminIcon({
  name,
  className,
  strokeWidth = 2,
}: {
  name: AdminIconName;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
