import { LeaveRequestView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function AttendanceRequestPage() {
  const data = await getAppData();
  return <LeaveRequestView {...data} />;
}
