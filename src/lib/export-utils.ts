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

/**
 * Download a binary file (XLSX, …). Accepts a `Uint8Array` of bytes so
 * generated workbooks can be written verbatim on native and web.
 */
export async function downloadBinaryFile(
  fileName: string,
  bytes: Uint8Array,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  if (Platform.OS === "web") {
    downloadOnWeb(fileName, bytes, mimeType);
    return;
  }

  const file = new ExpoFile(Paths.document, fileName);
  await file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  } else {
    Alert.alert("Exported", `File saved to: ${fileName}`);
  }
}

/**
 * Share an existing file (e.g. a PDF produced by expo-print). The file is
 * already on disk — we only hand it off to the share sheet.
 */
export async function shareExistingFile(
  uri: string,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  if (Platform.OS === "web") return;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle });
  } else {
    Alert.alert("Exported", "File saved to the app's documents directory.");
  }
}

function downloadOnWeb(
  fileName: string,
  content: string | Uint8Array,
  mimeType: string,
) {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return;

  const blob =
    typeof content === "string"
      ? new Blob([content], { type: mimeType })
      : new Blob([content as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  doc.body.appendChild(anchor);
  anchor.click();
  doc.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
