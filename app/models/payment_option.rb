# frozen_string_literal: true

class PaymentOption < ApplicationRecord
  include Deletable

  belongs_to :subscription
  belongs_to :price
  belongs_to :installment_plan,
             foreign_key: :product_installment_plan_id, class_name: "ProductInstallmentPlan",
             optional: true
  has_one :installment_plan_snapshot, dependent: :destroy

  validates :installment_plan, presence: true, if: -> { subscription&.is_installment_plan && installment_plan_snapshot.blank? }
  validates :installment_plan_snapshot, presence: true, if: -> { subscription&.is_installment_plan && installment_plan.blank? }

  after_create :update_subscription_last_payment_option
  after_update :update_subscription_last_payment_option, if: :saved_change_to_deleted_at?
  after_destroy :update_subscription_last_payment_option

  def offer_code
    subscription.original_purchase.offer_code
  end

  def variant_attributes
    subscription.original_purchase.variant_attributes
  end

  def update_subscription_last_payment_option
    subscription.update_last_payment_option
  end

  def effective_installment_plan
    if installment_plan_snapshot.present?
      installment_plan_snapshot
    else
      installment_plan
    end
  end

  def calculate_installment_payment_price_cents(full_price_cents)
    return unless subscription&.is_installment_plan?

    if installment_plan_snapshot.present?
      installment_plan_snapshot.calculate_installment_payment_price_cents
    elsif installment_plan.present?
      installment_plan.calculate_installment_payment_price_cents(full_price_cents)
    else
      return
    end
  end
end
