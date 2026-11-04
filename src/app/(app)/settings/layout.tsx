import { PageBody, PageHeader } from "@/components/page-header";
import { PageTabs } from "@/components/page-tabs";
import { SETTINGS_SECTIONS } from "@/components/shell/nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <PageHeader title="Réglages" nav={<PageTabs label="Sections des réglages" tabs={SETTINGS_SECTIONS} />} />
      <PageBody>
        <div className="mx-auto flex max-w-5xl flex-col gap-4">{children}</div>
      </PageBody>
    </>
  );
}
