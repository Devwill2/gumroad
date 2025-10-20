# frozen_string_literal: true

class InstallmentPlanSnapshot < ApplicationRecord
  belongs_to :payment_option

  validates :number_of_installments, presence: true,
            numericality: { only_integer: true, greater_than: 0 }
  validates :recurrence, presence: true
  validates :total_price_cents, presence: true,
            numericality: { only_integer: true, greater_than: 0 }
  validates :currency, presence: true
  validates :price_cents, presence: true,
            numericality: { only_integer: true, greater_than: 0 }

  validate :validate_price_consistency

  def calculate_installment_payment_price_cents
    base_price = total_price_cents / number_of_installments
    remainder = total_price_cents % number_of_installments

    Array.new(number_of_installments) do |i|
      i.zero? ? base_price + remainder : base_price
    end
  end

  private

  def validate_price_consistency
    return unless total_price_cents && price_cents && number_of_installments

    expected_total = price_cents * number_of_installments
    remainder = total_price_cents - expected_total

    if remainder < 0 || remainder >= number_of_installments
      errors.add(:total_price_cents, "must be within 0 to #{number_of_installments - 1} cents of price_cents * number_of_installments")
    end
  end
end
