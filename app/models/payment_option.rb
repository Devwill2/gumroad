# frozen_string_literal: true

class PaymentOption < ApplicationRecord
  include Deletable

  belongs_to :subscription
  belongs_to :price
  belongs_to :installment_plan,
             foreign_key: :product_installment_plan_id, class_name: "ProductInstallmentPlan",
             optional: true

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
      OpenStruct.new(
        number_of_installments: installment_plan_number_of_installments,
        recurrence: installment_plan_recurrence
      )
    else
      installment_plan
    end
  end

  def calculate_installment_payment_price_cents(full_price_cents)
    return unless subscription&.is_installment_plan?

    if installment_plan_snapshot.present?
      number_of_installments = installment_plan_number_of_installments
    elsif installment_plan.present?
      number_of_installments = installment_plan.number_of_installments
    else
      return
    end

    base_price = full_price_cents / number_of_installments
    remainder = full_price_cents % number_of_installments

    Array.new(number_of_installments) do |i|
      i.zero? ? base_price + remainder : base_price
    end
  end
end
