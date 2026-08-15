import { redirect } from 'next/navigation'

/** /admin is the questions list — that is where the work happens. */
export default function AdminIndexPage() {
  redirect('/admin/questions')
}
