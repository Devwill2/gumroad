# frozen_string_literal: true

require "spec_helper"

describe InstallmentPlanSnapshot do
  describe "validations" do
    it "requires all fields to be present" do
      snapshot = InstallmentPlanSnapshot.new
      expect(snapshot.valid?).to eq false
      expect(snapshot.errors[:number_of_installments]).to include("can't be blank")
      expect(snapshot.errors[:recurrence]).to include("can't be blank")
      expect(snapshot.errors[:total_price_cents]).to include("can't be blank")
      expect(snapshot.errors[:currency]).to include("can't be blank")
      expect(snapshot.errors[:price_cents]).to include("can't be blank")
    end

    it "validates numericality of price fields" do
      snapshot = InstallmentPlanSnapshot.new(
        number_of_installments: -1,
        total_price_cents: -100,
        price_cents: -50
      )
      expect(snapshot.valid?).to eq false
      expect(snapshot.errors[:number_of_installments]).to include("must be greater than 0")
      expect(snapshot.errors[:total_price_cents]).to include("must be greater than 0")
      expect(snapshot.errors[:price_cents]).to include("must be greater than 0")
    end

    it "validates price consistency" do
      payment_option = create(:payment_option)
      snapshot = InstallmentPlanSnapshot.new(
        payment_option: payment_option,
        number_of_installments: 3,
        recurrence: "monthly",
        total_price_cents: 3000,
        currency: "USD",
        price_cents: 1000
      )
      expect(snapshot.valid?).to eq true

      snapshot.price_cents = 999
      expect(snapshot.valid?).to eq false
      expect(snapshot.errors[:total_price_cents]).to include("must be within 0 to 2 cents of price_cents * number_of_installments")
    end
  end

  describe "#calculate_installment_payment_price_cents" do
    let(:payment_option) { create(:payment_option) }
    let(:snapshot) do
      create(:installment_plan_snapshot,
        payment_option: payment_option,
        number_of_installments: 3,
        total_price_cents: 3000,
        currency: "USD",
        price_cents: 1000
      )
    end

    it "calculates even distribution" do
      result = snapshot.calculate_installment_payment_price_cents
      expect(result).to eq([1000, 1000, 1000])
    end

    it "handles remainder correctly" do
      snapshot = create(:installment_plan_snapshot,
        payment_option: payment_option,
        number_of_installments: 3,
        total_price_cents: 3002,
        currency: "USD",
        price_cents: 1000
      )
      result = snapshot.calculate_installment_payment_price_cents
      expect(result).to eq([1002, 1000, 1000])
    end

    it "handles single installment" do
      snapshot.update!(number_of_installments: 1, total_price_cents: 2500, price_cents: 2500)
      result = snapshot.calculate_installment_payment_price_cents
      expect(result).to eq([2500])
    end
  end

  describe "associations" do
    it "belongs to payment_option" do
      payment_option = create(:payment_option)
      snapshot = create(:installment_plan_snapshot, payment_option: payment_option)
      expect(snapshot.payment_option).to eq(payment_option)
    end
  end
end
