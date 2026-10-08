import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { api } from "./api";

// Downloads the .xlsx from the backend, then opens the Android share sheet (WhatsApp, Drive, email...).
export async function exportExcel(path, filename) {
  const blob = await api(path, { blob: true });
  if (Capacitor.isNativePlatform()) {
    const b64 = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(",")[1]);
      r.readAsDataURL(blob);
    });
    const f = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
    await Share.share({ title: filename, url: f.uri });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
