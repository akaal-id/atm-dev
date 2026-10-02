import { redirect } from "next/navigation";

/** The leave form is a modal on the attendance page now. */
export default function AttendanceRequestPage() {
  redirect("/attendance?request=1");
}
