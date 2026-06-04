import { CalendarView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function CalendarPage() {
  const data = await getAppData(["Users", "Departments", "Tasks", "Projects", "Announcements", "Leave_Requests", "Calendar_Events"]);
  return <CalendarView {...data} />;
}
