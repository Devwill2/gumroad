# frozen_string_literal: true

class BackfillInstallmentPlanSnapshotData < ActiveRecord::Migration[7.1]
  def up
    PaymentOption.joins(:subscription)
                 .where("subscriptions.flags & ? > 0", Subscription.flag_mapping["flags"][:is_installment_plan])
                 .where.not(installment_plan: nil)
                 .where(installment_plan_snapshot: nil)
                 .find_each do |payment_option|
      installment_plan = payment_option.installment_plan
      next unless installment_plan.present?

      payment_option.update!(
        installment_plan_snapshot: {
          number_of_installments: installment_plan.number_of_installments,
          recurrence: installment_plan.recurrence
        },
        installment_plan_number_of_installments: installment_plan.number_of_installments,
        installment_plan_recurrence: installment_plan.recurrence
      )
    end
  end

  def down
    # Remove snapshot data (this is irreversible for data integrity)
    PaymentOption.where.not(installment_plan_snapshot: nil).update_all(
      installment_plan_snapshot: nil,
      installment_plan_number_of_installments: nil,
      installment_plan_recurrence: nil
    )
  end
end
