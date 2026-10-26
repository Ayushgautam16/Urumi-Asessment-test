<?php
/**
 * Plugin Name: Urumi Modern Store UI Enhancements
 * Description: Clean, minimal, human-designed store styling with modern typography and sleek product cards.
 * Version: 2.0.0
 */

// 1. Enqueue Google Fonts & Clean Minimalist CSS
add_action('wp_head', function() {
    ?>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style id="urumi-clean-theme-styles">
        :root {
            --urumi-font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --urumi-text: #09090b;
            --urumi-muted: #71717a;
            --urumi-border: #e4e4e7;
            --urumi-bg: #fafafa;
            --urumi-btn-bg: #18181b;
            --urumi-btn-hover: #27272a;
        }

        body {
            font-family: var(--urumi-font) !important;
            background-color: var(--urumi-bg) !important;
            color: var(--urumi-text) !important;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }

        /* Top Minimal Utility Bar */
        .urumi-top-bar {
            background: #ffffff;
            color: #71717a;
            font-size: 0.8rem;
            padding: 8px 24px;
            text-align: center;
            font-weight: 500;
            letter-spacing: 0.01em;
            border-bottom: 1px solid var(--urumi-border);
        }

        /* Clean Header */
        header.wp-block-template-part {
            background: #ffffff !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 100 !important;
            border-bottom: 1px solid var(--urumi-border) !important;
            padding: 16px 32px !important;
        }

        header .wp-block-site-title a {
            font-weight: 700 !important;
            font-size: 1.25rem !important;
            letter-spacing: -0.02em !important;
            color: #09090b !important;
            text-decoration: none !important;
        }

        .wp-block-navigation a {
            font-weight: 500 !important;
            color: #52525b !important;
            font-size: 0.9rem !important;
            text-decoration: none !important;
            transition: color 0.15s ease !important;
        }

        .wp-block-navigation a:hover {
            color: #09090b !important;
        }

        /* Minimal Page Header */
        .urumi-catalog-header {
            max-width: 1200px;
            margin: 40px auto 32px auto;
            padding: 0 24px;
        }

        .urumi-catalog-title {
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: -0.03em;
            color: #09090b;
            margin: 0 0 6px 0;
        }

        .urumi-catalog-sub {
            font-size: 0.95rem;
            color: #71717a;
            margin: 0;
        }

        /* Main Container */
        .wp-site-blocks, main, .woocommerce {
            max-width: 1200px !important;
            margin: 0 auto !important;
            padding: 0 24px !important;
        }

        /* Product Grid */
        ul.products {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)) !important;
            gap: 32px !important;
            padding: 0 !important;
            margin: 0 0 80px 0 !important;
            list-style: none !important;
        }

        ul.products li.product {
            background: #ffffff !important;
            border-radius: 14px !important;
            border: 1px solid var(--urumi-border) !important;
            padding: 20px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
            margin: 0 !important;
            float: none !important;
            width: auto !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
        }

        ul.products li.product:hover {
            transform: translateY(-4px) !important;
            border-color: #d4d4d8 !important;
            box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.08) !important;
        }

        /* Product Image */
        ul.products li.product img {
            border-radius: 10px !important;
            width: 100% !important;
            height: 260px !important;
            object-fit: cover !important;
            margin-bottom: 18px !important;
            background: #f4f4f5 !important;
            transition: transform 0.35s ease !important;
        }

        ul.products li.product:hover img {
            transform: scale(1.02) !important;
        }

        /* Product Title */
        ul.products li.product h2, ul.products li.product .woocommerce-loop-product__title {
            font-size: 1.05rem !important;
            font-weight: 600 !important;
            color: #09090b !important;
            margin: 0 0 6px 0 !important;
            line-height: 1.4 !important;
        }

        /* Price */
        ul.products li.product .price {
            font-size: 1.15rem !important;
            font-weight: 700 !important;
            color: #18181b !important;
            margin-bottom: 18px !important;
            display: block !important;
        }

        /* Modern Add to Cart Button */
        ul.products li.product .button.add_to_cart_button {
            background: var(--urumi-btn-bg) !important;
            color: #ffffff !important;
            border-radius: 8px !important;
            font-size: 0.88rem !important;
            font-weight: 600 !important;
            padding: 12px 18px !important;
            text-align: center !important;
            text-decoration: none !important;
            display: block !important;
            border: none !important;
            transition: all 0.15s ease !important;
            cursor: pointer !important;
        }

        ul.products li.product .button.add_to_cart_button:hover {
            background: var(--urumi-btn-hover) !important;
            color: #ffffff !important;
        }

        /* Hide Default Shop H1 if our custom is present */
        .woocommerce-products-header__title.page-title {
            display: none !important;
        }
        .woocommerce-result-count, .woocommerce-ordering {
            margin-bottom: 24px !important;
            font-size: 0.88rem !important;
            color: #71717a !important;
        }

        /* Checkout Page Polish */
        .woocommerce-checkout {
            background: #ffffff;
            border-radius: 14px;
            padding: 32px;
            border: 1px solid var(--urumi-border);
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
            margin: 32px auto 60px auto;
        }

        .woocommerce-checkout input[type="text"],
        .woocommerce-checkout input[type="email"],
        .woocommerce-checkout input[type="tel"] {
            border: 1px solid #d4d4d8 !important;
            border-radius: 8px !important;
            padding: 10px 14px !important;
            font-size: 0.92rem !important;
            font-family: var(--urumi-font) !important;
        }

        .woocommerce-checkout input:focus {
            outline: none !important;
            border-color: #09090b !important;
            box-shadow: 0 0 0 1px #09090b !important;
        }

        #place_order {
            background: #09090b !important;
            font-size: 1rem !important;
            font-weight: 600 !important;
            padding: 14px 28px !important;
            border-radius: 8px !important;
            border: none !important;
            width: 100% !important;
            color: #ffffff !important;
            cursor: pointer !important;
            transition: background 0.15s ease !important;
        }

        #place_order:hover {
            background: #27272a !important;
        }
    </style>
    <?php
});

// 2. Simple, tasteful Top Bar and Catalog Header (No Emojis)
add_action('wp_body_open', function() {
    ?>
    <div class="urumi-top-bar">
        Free domestic shipping &bull; Cash on Delivery available at checkout
    </div>
    <?php
    if (is_shop() || is_front_page()) {
        ?>
        <div class="urumi-catalog-header">
            <h1 class="urumi-catalog-title">Hardware & Peripherals</h1>
            <p class="urumi-catalog-sub">Precision mechanical keyboards, ergonomic mice, and studio audio gear.</p>
        </div>
        <?php
    }
});
