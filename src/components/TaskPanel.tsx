import { useEffect } from "react";
import { CheckCircle2, Circle, FileText, RefreshCw } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";

export function TaskPanel() {
  const app = useAppContext();
  const vault = useVaultContext();
  const openTasks = vault.tasks.filter((task) => !task.completed);
  const completedTasks = vault.tasks.filter((task) => task.completed);

  useEffect(() => {
    const id = window.setTimeout(() => void vault.refreshTasks(), 120);
    return () => window.clearTimeout(id);
  }, [vault.selectedPath, vault.content, vault.notes.length]);

  const renderTask = (task: typeof vault.tasks[number]) => (
    <div key={task.id} className={`task-row ${task.completed ? "done" : ""}`}>
      <button className="task-toggle" title={task.completed ? app.t.markTaskOpen : app.t.markTaskDone} onClick={() => void vault.toggleTask(task)}>
        {task.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </button>
      <button className="task-open" onClick={() => void vault.openTask(task)}>
        <span>{task.text}</span>
        <small>{task.title} · {app.t.line} {task.line}</small>
      </button>
    </div>
  );

  return (
    <section className="task-panel">
      <header className="task-panel-header">
        <div>
          <h2>{app.t.tasks}</h2>
          <p>{app.t.tasksHint}</p>
        </div>
        <button onClick={() => void vault.refreshTasks()} disabled={vault.isLoadingTasks}>
          <RefreshCw size={16} />
          <span>{app.t.refreshVault}</span>
        </button>
      </header>

      <div className="task-summary">
        <span><Circle size={14} />{app.t.openTasks}: {openTasks.length}</span>
        <span><CheckCircle2 size={14} />{app.t.completedTasks}: {completedTasks.length}</span>
        <span><FileText size={14} />{app.t.notes}: {vault.notes.length}</span>
      </div>

      <div className="task-columns">
        <section>
          <h3>{app.t.openTasks}</h3>
          {vault.isLoadingTasks ? <p className="task-empty">{app.t.loadingTasks}</p> : openTasks.length === 0 ? <p className="task-empty">{app.t.noOpenTasks}</p> : openTasks.map(renderTask)}
        </section>
        <section>
          <h3>{app.t.completedTasks}</h3>
          {vault.isLoadingTasks ? <p className="task-empty">{app.t.loadingTasks}</p> : completedTasks.length === 0 ? <p className="task-empty">{app.t.noCompletedTasks}</p> : completedTasks.slice(0, 80).map(renderTask)}
        </section>
      </div>
    </section>
  );
}
