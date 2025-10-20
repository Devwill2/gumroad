# frozen_string_literal: true

FactoryBot.define do
  factory :installment_plan_snapshot do
    payment_option
    number_of_installments { 3 }
    recurrence { "monthly" }
    total_price_cents { 3000 }
    currency { "USD" }
    price_cents { 1000 }

    trait :with_remainder do
      total_price_cents { 3002 }
      price_cents { 1000 }
    end

    trait :single_installment do
      number_of_installments { 1 }
      total_price_cents { 2500 }
      price_cents { 2500 }
    end
  end
end
