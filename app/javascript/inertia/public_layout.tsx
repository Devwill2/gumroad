import { Head, usePage } from "@inertiajs/react";
import React from "react";

import Alert, { showAlert, type AlertPayload } from "$app/components/server-components/Alert";

type PageProps = {
  title: string;
  flash?: AlertPayload;
};

/**
 * Public layout for pages that don't require authentication (e.g., Blog)
 * This layout doesn't show the dashboard navigation.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { title, flash } = usePage<PageProps>().props;

  React.useEffect(() => {
    if (flash?.message) {
      showAlert(flash.message, flash.status === "danger" ? "error" : flash.status);
    }
  }, [flash]);

  return (
    <>
      <Head title={title} />
      <Alert initial={flash ?? null} />
      <main>{children}</main>
    </>
  );
}
