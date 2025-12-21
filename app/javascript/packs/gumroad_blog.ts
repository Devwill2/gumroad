import ReactOnRails from "react-on-rails";

import BasePage from "$app/utils/base_page";

import GumroadBlogIndexPage from "$app/components/server-components/GumroadBlog/IndexPage";

BasePage.initialize();

ReactOnRails.register({ GumroadBlogIndexPage });
