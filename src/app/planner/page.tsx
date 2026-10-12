import { signOut } from "@/auth";
import linkStyles from "@/components/Link.module.css";
import { cx } from "@/components/types";
import { requireOwner } from "@/lib/owner";
import { getDueSoon, getSettingsMasked, getStatus, listClasses, listTasks } from "@/lib/planner/queries";
import { plannerToday } from "@/lib/planner/time";
import { CanvasSyncLine } from "./_components/CanvasSyncLine";
import { Planner } from "./_components/Planner";
import { parseView } from "./_lib/views";
import styles from "./planner.module.css";

// The session is read at request time; no Suspense so notFound() happens
// before any bytes stream and the response is a real 404. The planner data
// is owner-only and uncached, so it is read here too, after the gate.
export const instant = false;

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  await requireOwner();
  const [tasks, classes, status, dueSoon, settings, params] = await Promise.all([
    listTasks(),
    listClasses(),
    getStatus(),
    getDueSoon(3),
    getSettingsMasked(),
    searchParams,
  ]);

  return (
    <main className={cx("mn-section", styles.me)}>
      <header className="mn-section__head">
        <div className={styles.headCol}>
          {/* Only the owner (GitHub MasaCTC, checked by id) gets past requireOwner. */}
          <span className="mn-label">Private · only you · signed in as MasaCTC</span>
          <h1 className="mn-display-lg">Planner</h1>
        </div>
        <div className="mn-row">
          <CanvasSyncLine />
          <form action={signOutAction} className={styles.signOut}>
            <button type="submit" className={cx("mn-link", linkStyles.asButton)}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      <Planner
        today={plannerToday()}
        tasks={tasks}
        classes={classes}
        status={status}
        dueSoon={dueSoon}
        settings={settings}
        initialView={parseView(params.view)}
      />
    </main>
  );
}
