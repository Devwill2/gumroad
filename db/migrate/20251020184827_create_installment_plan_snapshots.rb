class CreateInstallmentPlanSnapshots < ActiveRecord::Migration[7.1]
  def change
    create_table :installment_plan_snapshots do |t|
      t.integer :payment_option_id, null: false
      t.integer :number_of_installments, null: false
      t.string :recurrence, null: false
      t.integer :total_price_cents, null: false
      t.string :currency, null: false
      t.integer :price_cents, null: false
      t.timestamps
    end

    add_foreign_key :installment_plan_snapshots, :payment_options

    add_index :installment_plan_snapshots, :payment_option_id, unique: true, name: 'index_installment_plan_snapshots_on_payment_option_id'
  end
end
