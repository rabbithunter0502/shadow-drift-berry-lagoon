import { createFileRoute } from "@tanstack/react-router";
import { ThuaApp } from "@/components/thua/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ThuaApp />;
}
