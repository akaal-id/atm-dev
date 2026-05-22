import { CalendarView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function CalendarPage() {
  const data = await getAppData();
  return <CalendarView {...data} />;
}
