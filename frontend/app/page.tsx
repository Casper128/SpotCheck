import Dashboard from "@/presentation/components/Dashboard";
import { AccessGate } from "@/presentation/auth/AccessGate";
export default function Home() { return <AccessGate><Dashboard /></AccessGate>; }
