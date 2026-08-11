/**
 * Cross-platform file download / share helper.
 *
 * Web: triggers a browser download via a Blob + anchor element.
 * Native: writes the file with expo-file-system and shares it with
 *         expo-sharing (falls back to an alert when sharing is unavailable).
 *
 * Used by the Reports screen so exports work identically on iOS, Android,
 * and web.
 */

import { Alert, Platform } from "react-native";
import { File as ExpoFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Download a text file (CSV, TXT, …). Resolves once the export has been
 * handed off (browser download started / share sheet opened).
 */
export async function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  if (Platform.OS === "web") {
    downloadOnWeb(fileName, content, mimeType);
    return;
  }

  const file = new ExpoFile(Paths.document, fileName);
  await file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  } else {
    Alert.alert("Exported", `File saved to: ${fileName}`);
  }
}

function downloadOnWeb(fileName: string, content: string, mimeType: string) {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  doc.body.appendChild(anchor);
  anchor.click();
  doc.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
