import { useCallback, useState } from "react";
import type { JsonFieldConfig } from "../components/JsonFieldSelectorModal";
import type { QueuedImportIssue, QueuedImportItem } from "./types";
import { inspectJsonFile, validateFileBeforeRead } from "../utils/filePipeline";

function createQueueId(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}::${crypto.randomUUID()}`;
}

export function useImportQueue() {
  const [pendingImports, setPendingImports] = useState<QueuedImportItem[]>([]);
  const [validationIssues, setValidationIssues] = useState<QueuedImportIssue[]>([]);
  const [activeJsonFieldConfig, setActiveJsonFieldConfig] = useState<JsonFieldConfig | null>(null);

  const addFiles = useCallback(async (files: File[]) => {
    const preparedEntries = await Promise.all(
      files.map(async (file) => {
        const queueId = createQueueId(file);
        const validationError = validateFileBeforeRead(file);
        if (validationError) {
          return {
            kind: "issue" as const,
            issue: {
              queueId,
              fileName: file.name,
              fileSizeBytes: file.size,
              reason: validationError.reason,
            },
          };
        }

        const inspection = file.name.toLowerCase().endsWith(".json")
          ? await inspectJsonFile(file).catch(() => null)
          : null;
        const fieldOptions = inspection?.fieldOptions ?? [];

        return {
          kind: "item" as const,
          item: {
            queueId,
            file,
            fileName: file.name,
            selectedJsonFields: fieldOptions.map((field) => field.path),
            fieldOptions,
          },
        };
      }),
    );

    const preparedItems = preparedEntries.flatMap((entry) => (entry.kind === "item" ? [entry.item] : []));
    const issues = preparedEntries.flatMap((entry) => (entry.kind === "issue" ? [entry.issue] : []));
    setPendingImports((previous) => [...previous, ...preparedItems]);
    setValidationIssues((previous) => [...previous, ...issues]);
  }, []);

  const removePendingImport = useCallback((queueId: string) => {
    setPendingImports((previous) => previous.filter((item) => item.queueId !== queueId));
    setActiveJsonFieldConfig((previous) => (previous?.fileKey === queueId ? null : previous));
  }, []);

  const clearPendingImports = useCallback(() => {
    setPendingImports([]);
    setValidationIssues([]);
    setActiveJsonFieldConfig(null);
  }, []);

  const openJsonFieldEditor = useCallback((queueId: string) => {
    setPendingImports((previous) => {
      const item = previous.find((entry) => entry.queueId === queueId);
      if (!item || item.fieldOptions.length === 0) {
        return previous;
      }

      setActiveJsonFieldConfig({
        fileKey: item.queueId,
        fileName: item.fileName,
        fieldOptions: item.fieldOptions,
        selectedPaths: item.selectedJsonFields,
      });
      return previous;
    });
  }, []);

  const closeJsonFieldEditor = useCallback(() => {
    setActiveJsonFieldConfig(null);
  }, []);

  const updateJsonFieldSelection = useCallback((queueId: string, selectedPaths: string[]) => {
    setPendingImports((previous) =>
      previous.map((item) =>
        item.queueId === queueId ? { ...item, selectedJsonFields: selectedPaths } : item,
      ),
    );
    setActiveJsonFieldConfig((previous) =>
      previous?.fileKey === queueId ? { ...previous, selectedPaths } : previous,
    );
  }, []);

  const removeCompletedImports = useCallback((completedQueueIds: string[]) => {
    if (completedQueueIds.length === 0) {
      return;
    }

    const completed = new Set(completedQueueIds);
    setPendingImports((previous) => previous.filter((item) => !completed.has(item.queueId)));
    setActiveJsonFieldConfig((previous) =>
      previous && completed.has(previous.fileKey) ? null : previous,
    );
  }, []);

  return {
    activeJsonFieldConfig,
    addFiles,
    clearPendingImports,
    closeJsonFieldEditor,
    openJsonFieldEditor,
    pendingImports,
    validationIssues,
    removeCompletedImports,
    removePendingImport,
    updateJsonFieldSelection,
  };
}
