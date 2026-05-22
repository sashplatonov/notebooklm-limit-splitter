import { useAppController } from "./app/useAppController";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import HeroSection from "./components/HeroSection";
import JsonFieldSelectorModal from "./components/JsonFieldSelectorModal";
import ProcessingWorkspace from "./components/ProcessingWorkspace";

export default function App() {
  const app = useAppController();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-canvas)] text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_24%),linear-gradient(180deg,#fff8ef_0%,#fffdf8_44%,#f8fafc_100%)]" />
      <AppHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
        <HeroSection />
        <ProcessingWorkspace
          errorMessage={app.errorMessage}
          handleFiles={app.handleFiles}
          limits={app.limits}
          notificationPermission={app.notificationPermission}
          notificationsEnabled={app.notificationsEnabled}
          notificationRequestPending={app.notificationRequestPending}
          notebookPlan={app.notebookPlan}
          onClearPendingImports={app.onClearPendingImports}
          onClearAll={app.onClearAll}
          onDisableNotifications={app.onDisableNotifications}
          onDownloadArchive={app.onDownloadArchive}
          onEnableNotifications={app.onEnableNotifications}
          onEditJsonFields={app.onEditJsonFields}
          onRemoveResult={app.onRemoveResult}
          onRemovePendingImport={app.onRemovePendingImport}
          onStartProcessing={app.onStartProcessing}
          onStopProcessing={app.onStopProcessing}
          pendingImports={app.pendingImports}
          validationIssues={app.validationIssues}
          onToggleSettings={app.onToggleSettings}
          processing={app.processing}
          progress={app.progress}
          results={app.results}
          settingsOpen={app.settingsOpen}
          setLimits={app.setLimits}
        />
      </main>
      <AppFooter
        lastRunSummary={app.lastRunSummary}
        resultsCount={app.results.length}
        stats={app.processingStats}
        totalChunks={app.notebookPlan.totalChunks}
        totalNotebooks={app.notebookPlan.totalNotebooks}
      />
      {app.activeJsonFieldConfig && (
        <JsonFieldSelectorModal
          config={app.activeJsonFieldConfig}
          onCancel={app.onJsonFieldModalCancel}
          onConfirm={app.onJsonFieldModalConfirm}
          onChangeSelection={app.onJsonFieldModalChangeSelection}
        />
      )}
    </div>
  );
}
