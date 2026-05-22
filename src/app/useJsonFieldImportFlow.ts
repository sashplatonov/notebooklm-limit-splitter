import { useCallback, useState } from "react";
import type { JsonFieldConfig } from "../components/JsonFieldSelectorModal";
import { inspectJsonFile } from "../utils/filePipeline";

function createFileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function useJsonFieldImportFlow(
  processSelectedFiles: (files: File[], jsonFieldSelections?: Record<string, string[]>) => Promise<void>,
) {
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [jsonFieldConfigs, setJsonFieldConfigs] = useState<JsonFieldConfig[] | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith(".json"));
    if (jsonFiles.length === 0) {
      await processSelectedFiles(files);
      return;
    }

    const inspections = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const inspection = await inspectJsonFile(file);
          if (!inspection || inspection.fieldOptions.length === 0) {
            return null;
          }

          return {
            fileKey: createFileKey(file),
            fileName: file.name,
            fieldOptions: inspection.fieldOptions,
            selectedPaths: inspection.fieldOptions.map((field) => field.path),
          } satisfies JsonFieldConfig;
        } catch {
          return null;
        }
      }),
    );

    const configs = inspections.filter((item): item is JsonFieldConfig => item !== null);
    if (configs.length === 0) {
      await processSelectedFiles(files);
      return;
    }

    setPendingFiles(files);
    setJsonFieldConfigs(configs);
  }, [processSelectedFiles]);

  const closeJsonFieldSelector = useCallback(() => {
    setPendingFiles(null);
    setJsonFieldConfigs(null);
  }, []);

  const confirmJsonFieldSelection = useCallback(async () => {
    if (!pendingFiles || !jsonFieldConfigs) {
      return;
    }

    const jsonFieldSelections = Object.fromEntries(
      jsonFieldConfigs.map((config) => [config.fileKey, config.selectedPaths]),
    );

    closeJsonFieldSelector();
    await processSelectedFiles(pendingFiles, jsonFieldSelections);
  }, [closeJsonFieldSelector, jsonFieldConfigs, pendingFiles, processSelectedFiles]);

  const updateJsonFieldSelection = useCallback((fileKey: string, selectedPaths: string[]) => {
    setJsonFieldConfigs((previous) => {
      if (!previous) {
        return previous;
      }

      return previous.map((config) =>
        config.fileKey === fileKey ? { ...config, selectedPaths } : config,
      );
    });
  }, []);

  return {
    handleFiles,
    jsonFieldConfigs,
    closeJsonFieldSelector,
    confirmJsonFieldSelection,
    updateJsonFieldSelection,
  };
}
