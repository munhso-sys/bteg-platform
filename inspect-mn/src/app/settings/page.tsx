import { requireSettingsAdminPage } from "@/lib/rbac/require-settings";
import SettingsGeneralClient from "./SettingsGeneralClient";

export default async function SettingsPage() {
  await requireSettingsAdminPage();
  return <SettingsGeneralClient />;
}
