import { signOut } from "@/auth";
import linkStyles from "@/components/Link.module.css";
import { cx } from "@/components/types";
import { requireOwner } from "@/lib/owner";
import { getDueSoon, getSettingsMasked, getStatus, listClasses, listTasks } from "@/lib/planner/queries";
import { plannerToday } from "@/lib/planner/time";
import { CanvasSyncLine, CanvasSyncProvider } from "./_components/CanvasSyncLine";
import { Planner } from "./_components/Planner";
import { parseView } from "./_lib/views";
import styles from "./planner.module.css";

// The real 404 for signed-out visitors comes from src/proxy.ts, which runs
// before this page renders; do not remove it. requireOwner() below is only
// defence in depth (it calls notFound() if the proxy were ever bypassed). The
// session is read at request time and the planner data is owner-only and
// uncached, so it is read here too, after the gate. `instant = false` is not
// what produces the 404.
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
      {/* Canvas sync runs after the page is shown (see CanvasSyncLine). */}
      <CanvasSyncProvider hasFeed={settings.hasFeed}>
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
      </CanvasSyncProvider>
    </main>
  );
}
