import { AttendanceView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function AttendancePage() {
  const data = await getAppData();
  return <AttendanceView {...data} />;
}
