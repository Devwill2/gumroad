# frozen_string_literal: true

require "spec_helper"

describe PaymentOption do
  describe "validation" do
    it "considers a PaymentOption to be invalid unless all required information is provided" do
      payment_option = PaymentOption.new
      expect(payment_option.valid?).to eq false

      product = create(:subscription_product)
      subscription = create(:subscription, link: product)

      payment_option.subscription = subscription
      expect(payment_option.valid?).to eq false

      payment_option.price = product.prices.last
      expect(payment_option.valid?).to eq true
    end

    it "requires installment_plan when subscription is an installment plan" do
      subscription = create(:subscription, is_installment_plan: false)

      payment_option = build(:payment_option, subscription:, installment_plan: nil)
      expect(payment_option.valid?).to eq true

      subscription.update!(is_installment_plan: true)
      expect(payment_option.valid?).to eq false

      installment_plan = build(:product_installment_plan)
      payment_option.installment_plan = installment_plan
      expect(payment_option.valid?).to eq true
    end

    it "requires installment_plan_snapshot when subscription is an installment plan and no installment_plan" do
      product = create(:product, price_cents: 3000) # $30.00
      installment_plan = create(:product_installment_plan, link: product, number_of_installments: 3)
      subscription = create(:subscription, link: product, is_installment_plan: true)

      payment_option = build(:payment_option, subscription:, installment_plan: nil)
      expect(payment_option.valid?).to eq false

      payment_option.build_installment_plan_snapshot(
        number_of_installments: 3,
        recurrence: "monthly",
        total_price_cents: 3000,
        currency: "USD",
        price_cents: 1000
      )
      expect(payment_option.valid?).to eq true
    end

    it "allows either installment_plan or installment_plan_snapshot for installment plans" do
      product = create(:product, price_cents: 3000) # $30.00
      installment_plan = create(:product_installment_plan, link: product, number_of_installments: 3)
      subscription = create(:subscription, link: product, is_installment_plan: true)

      payment_option = build(:payment_option, subscription:, installment_plan:, installment_plan_snapshot: nil)
      expect(payment_option.valid?).to eq true

      payment_option = build(:payment_option, subscription:, installment_plan: nil)
      payment_option.build_installment_plan_snapshot(
        number_of_installments: 3,
        recurrence: "monthly",
        total_price_cents: 3000,
        currency: "USD",
        price_cents: 1000
      )
      expect(payment_option.valid?).to eq true
    end
  end

  describe "#update_subscription_last_payment_option" do
    it "sets correct payment_option on creation and destruction" do
      subscription = create(:subscription)
      payment_option_1 = create(:payment_option, subscription:)
      expect(subscription.reload.last_payment_option).to eq(payment_option_1)

      payment_option_2 = create(:payment_option, subscription:)
      payment_option_3 = create(:payment_option, subscription:)
      expect(subscription.reload.last_payment_option).to eq(payment_option_3)

      payment_option_3.destroy
      expect(subscription.reload.last_payment_option).to eq(payment_option_2)

      payment_option_2.mark_deleted!
      expect(subscription.reload.last_payment_option).to eq(payment_option_1)

      payment_option_2.mark_undeleted!
      expect(subscription.reload.last_payment_option).to eq(payment_option_2)
    end
  end

  describe "#effective_installment_plan" do
    it "returns installment_plan when available" do
      product = create(:product, price_cents: 3000) # $30.00
      installment_plan = create(:product_installment_plan, link: product, number_of_installments: 3, recurrence: "monthly")
      subscription = create(:subscription, link: product, is_installment_plan: true)
      payment_option = create(:payment_option, subscription:, installment_plan:)

      effective_plan = payment_option.effective_installment_plan
      expect(effective_plan).to eq(installment_plan)
    end

  end

  describe "#calculate_installment_payment_price_cents" do
    it "calculates payment amounts using installment_plan" do
      product = create(:product, price_cents: 3000) # $30.00
      installment_plan = create(:product_installment_plan, link: product, number_of_installments: 3)
      subscription = create(:subscription, link: product, is_installment_plan: true)
      payment_option = create(:payment_option, subscription:, installment_plan:)

      result = payment_option.calculate_installment_payment_price_cents(3000)
      expect(result).to eq([1000, 1000, 1000])
    end


    it "returns nil for non-installment subscriptions" do
      product = create(:product, price_cents: 3000) # $30.00
      subscription = create(:subscription, link: product, is_installment_plan: false)
      payment_option = create(:payment_option, subscription:)

      result = payment_option.calculate_installment_payment_price_cents(3000)
      expect(result).to be_nil
    end
  end
end
