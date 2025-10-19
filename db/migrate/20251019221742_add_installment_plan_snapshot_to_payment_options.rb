# frozen_string_literal: true

class AddInstallmentPlanSnapshotToPaymentOptions < ActiveRecord::Migration[7.1]
  def change
    add_column :payment_options, :installment_plan_snapshot, :json
    add_column :payment_options, :installment_plan_number_of_installments, :integer
    add_column :payment_options, :installment_plan_recurrence, :string

  end
end
