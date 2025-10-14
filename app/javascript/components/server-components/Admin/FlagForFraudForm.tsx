import * as React from "react";
import { createCast } from "ts-safe-cast";

import { register } from "$app/utils/serverComponentUtil";

import { Form } from "$app/components/Admin/Form";
import { showAlert } from "$app/components/server-components/Alert";

export const AdminFlagForFraudForm = ({ user_id }: { user_id: number }) => (
  <Form
    url={Routes.flag_for_fraud_admin_user_path(user_id)}
    method="POST"
    confirmMessage={`Are you sure you want to flag user ${user_id} for fraud?`}
    onSuccess={() => showAlert("Flagged.", "success")}
  >
    {(isLoading) => (
      <fieldset>
        <div className="grid grid-flow-col gap-3 grid-cols-[1fr] auto-cols-max items-center" style={{ alignItems: "start" }}>
          <textarea name="flag_for_fraud[flag_note]" rows={3} placeholder="Add flag note (optional)" />
          <button type="submit" className="button" disabled={isLoading}>
            {isLoading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </fieldset>
    )}
  </Form>
);

export default register({ component: AdminFlagForFraudForm, propParser: createCast() });
