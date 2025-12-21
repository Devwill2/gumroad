# frozen_string_literal: true

require "spec_helper"
require "shared_examples/sellers_base_controller_concern"
require "shared_examples/authorize_called"
require "inertia_rails/rspec"

describe Settings::PasswordController, :vcr do
  it_behaves_like "inherits from Sellers::BaseController"

  let (:user) { create(:user) }

  before do
    sign_in user
  end

  it_behaves_like "authorize called for controller", Settings::Password::UserPolicy do
    let(:record) { user }
  end

  describe "GET show" do
    it "renders Inertia component with correct props", inertia: true do
      get :show

      expect(response).to be_successful
      expect_inertia.to render_component("Settings/Password")
      expect_inertia.to include_props(
        require_old_password: true,
        settings_pages: %w(main profile team payments password third_party_analytics advanced)
      )
    end
  end

  describe "PUT update" do
    context "when request payload is missing" do
      it "redirects with error" do
        with_real_pwned_password_check do
          put :update, params: {}
        end
        expect(response).to redirect_to(settings_password_path)
      end
    end

    context "when the specified new password is not compromised" do
      it "redirects with success notice" do
        with_real_pwned_password_check do
          put :update, params: { user: { password: user.password, new_password: "#{user.password}-new" } }
        end
        expect(response).to redirect_to(settings_password_path)
        expect(flash[:notice]).to eq("You have successfully changed your password.")
      end
    end

    context "when the specified new password is compromised" do
      it "redirects with error" do
        with_real_pwned_password_check do
          put :update, params: { user: { password: user.password, new_password: "password" } }
        end
        expect(response).to redirect_to(settings_password_path)
      end
    end

    it "invalidates the user's active sessions and keeps the current session active" do
      travel_to(DateTime.current) do
        expect do
          put :update, params: { user: { password: user.password, new_password: "#{user.password}-new" } }
        end.to change { user.reload.last_active_sessions_invalidated_at }.from(nil).to(DateTime.current)

        expect(response).to redirect_to(settings_password_path)
        expect(request.env["warden"].session["last_sign_in_at"]).to eq(DateTime.current.to_i)
      end
    end
  end

  describe "PUT update with social-provided account" do
    let (:user) { create(:user, provider: :facebook) }

    before do
      sign_in user
    end

    it "redirects with success without checking for old password" do
      with_real_pwned_password_check do
        put :update, params: { user: { password: "", new_password: "#{user}-new" } }
      end
      expect(response).to redirect_to(settings_password_path)
      expect(flash[:notice]).to eq("You have successfully changed your password.")
    end
  end
end

