<?php
/**
 * Plugin Name: Urumi Modern Store UI Enhancements
 * Description: Injects modern typography, glassmorphic header, hero banner, product cards, and sleek checkout styling.
 * Version: 1.0.0
 */

// 1. Enqueue Google Fonts & Custom CSS in Head
add_action('wp_head', function() {
    ?>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style id="urumi-custom-theme-styles">
        :root {
            --urumi-primary: #0f172a;
            --urumi-accent: #10b981;
            --urumi-accent-hover: #059669;
            --urumi-accent-glow: rgba(16, 185, 129, 0.25);
            --urumi-bg: #f8fafc;
            --urumi-surface: #ffffff;
            --urumi-border: #e2e8f0;
            --urumi-text: #1e293b;
            --urumi-text-muted: #64748b;
            --urumi-radius: 16px;
            --urumi-font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        body {
            font-family: var(--urumi-font) !important;
            background-color: var(--urumi-bg) !important;
            color: var(--urumi-text) !important;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }

        /* Top Announcement Bar */
        .urumi-announcement-bar {
            background: #090d16;
            color: #94a3b8;
            font-size: 0.8rem;
            padding: 8px 16px;
            text-align: center;
            font-weight: 500;
            letter-spacing: 0.02em;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .urumi-announcement-bar strong {
            color: #10b981;
        }

        /* Modern Hero Section */
        .urumi-hero-banner {
            background: linear-gradient(135deg, #090d16 0%, #111827 50%, #064e3b 100%);
            color: #ffffff;
            padding: 60px 24px;
            text-align: center;
            border-radius: 0 0 24px 24px;
            margin-bottom: 48px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.3);
        }
        .urumi-hero-banner::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.15), transparent 70%);
            pointer-events: none;
        }
        .urumi-hero-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 100px;
            padding: 6px 14px;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 16px;
        }
        .urumi-hero-title {
            font-size: 2.75rem;
            font-weight: 800;
            letter-spacing: -0.03em;
            margin: 0 0 14px 0;
            line-height: 1.15;
            background: linear-gradient(180deg, #ffffff 40%, #cbd5e1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .urumi-hero-subtitle {
            font-size: 1.1rem;
            color: #94a3b8;
            max-width: 640px;
            margin: 0 auto 28px auto;
            line-height: 1.6;
        }
        .urumi-hero-features {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }
        .urumi-feature-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.06);
            backdrop-filter: blur(8px);
            padding: 8px 16px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 0.85rem;
            color: #e2e8f0;
            font-weight: 500;
        }

        /* Container Layout */
        .wp-site-blocks, main, .woocommerce {
            max-width: 1240px !important;
            margin: 0 auto !important;
            padding: 0 20px !important;
        }

        /* Product Grid & Cards */
        ul.products, .wc-block-grid__products {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
            gap: 28px !important;
            padding: 0 !important;
            margin: 0 0 60px 0 !important;
            list-style: none !important;
        }

        ul.products li.product, .wc-block-grid__product {
            background: #ffffff !important;
            border-radius: var(--urumi-radius) !important;
            border: 1px solid var(--urumi-border) !important;
            box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 4px -2px rgba(15, 23, 42, 0.02) !important;
            padding: 20px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            position: relative !important;
            overflow: hidden !important;
            margin: 0 !important;
            float: none !important;
            width: auto !important;
        }

        ul.products li.product:hover, .wc-block-grid__product:hover {
            transform: translateY(-6px) !important;
            border-color: #cbd5e1 !important;
            box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04) !important;
        }

        /* Product Images */
        ul.products li.product img, .wc-block-grid__product-image img {
            border-radius: 12px !important;
            width: 100% !important;
            height: 240px !important;
            object-fit: cover !important;
            margin-bottom: 16px !important;
            transition: transform 0.4s ease !important;
            background: #f1f5f9;
        }

        ul.products li.product:hover img {
            transform: scale(1.03) !important;
        }

        /* Product Title */
        ul.products li.product h2, ul.products li.product .woocommerce-loop-product__title, .wc-block-grid__product-title {
            font-size: 1.05rem !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            margin: 0 0 8px 0 !important;
            line-height: 1.4 !important;
            height: 2.8em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        /* Price Tag */
        .price, .wc-block-grid__product-price {
            font-size: 1.25rem !important;
            font-weight: 800 !important;
            color: #059669 !important;
            margin-bottom: 16px !important;
            display: block !important;
        }

        /* Add to Cart Button */
        .add_to_cart_button, .wp-block-button__link, .button.product_type_simple {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
            color: #ffffff !important;
            border-radius: 10px !important;
            font-size: 0.9rem !important;
            font-weight: 700 !important;
            padding: 12px 20px !important;
            text-align: center !important;
            text-decoration: none !important;
            display: block !important;
            border: none !important;
            box-shadow: 0 4px 14px var(--urumi-accent-glow) !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
        }

        .add_to_cart_button:hover, .wp-block-button__link:hover, .button.product_type_simple:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4) !important;
            background: linear-gradient(135deg, #047857 0%, #059669 100%) !important;
            color: #ffffff !important;
        }

        /* Added to Cart Feedback Badge */
        .added_to_cart {
            display: inline-block !important;
            margin-top: 8px !important;
            font-size: 0.85rem !important;
            color: #059669 !important;
            font-weight: 600 !important;
            text-align: center !important;
        }

        /* Header Navigation Polish */
        header.wp-block-template-part {
            background: rgba(255, 255, 255, 0.92) !important;
            backdrop-filter: blur(12px) !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 100 !important;
            border-bottom: 1px solid var(--urumi-border) !important;
            padding: 12px 24px !important;
        }

        header .wp-block-site-title a {
            font-weight: 800 !important;
            letter-spacing: -0.02em !important;
            font-size: 1.35rem !important;
            color: #0f172a !important;
            text-decoration: none !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        header .wp-block-site-title a::before {
            content: '⚡';
            font-size: 1.2rem;
        }

        .wp-block-navigation a {
            font-weight: 600 !important;
            color: #334155 !important;
            font-size: 0.92rem !important;
            transition: color 0.15s ease !important;
        }

        .wp-block-navigation a:hover {
            color: #10b981 !important;
        }

        /* Checkout Page Polish */
        .woocommerce-checkout {
            background: #ffffff;
            border-radius: 16px;
            padding: 32px;
            border: 1px solid var(--urumi-border);
            box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05);
            margin: 32px auto 60px auto;
        }

        .woocommerce-checkout input[type="text"],
        .woocommerce-checkout input[type="email"],
        .woocommerce-checkout input[type="tel"] {
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            padding: 10px 14px !important;
            font-size: 0.95rem !important;
            font-family: var(--urumi-font) !important;
            transition: all 0.2s ease !important;
        }

        .woocommerce-checkout input:focus {
            outline: none !important;
            border-color: #10b981 !important;
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15) !important;
        }

        #place_order {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
            font-size: 1.1rem !important;
            font-weight: 700 !important;
            padding: 16px 32px !important;
            border-radius: 12px !important;
            border: none !important;
            width: 100% !important;
            color: #ffffff !important;
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3) !important;
            cursor: pointer !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease !important;
        }

        #place_order:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4) !important;
        }
    </style>
    <?php
});

// 2. Insert Announcement Bar & Hero Banner right after header on shop/home pages
add_action('wp_body_open', function() {
    ?>
    <div class="urumi-announcement-bar">
        🚀 <strong>URUMI CLOUD PLATFORM</strong> &bull; Stateful WooCommerce on Kubernetes &bull; Team MCP Gateway Integrated
    </div>
    <?php
    if (is_shop() || is_front_page()) {
        ?>
        <div class="urumi-hero-banner">
            <div class="urumi-hero-tag">⚡ Kubernetes E-Commerce</div>
            <h1 class="urumi-hero-title">High-Performance Hardware Store</h1>
            <p class="urumi-hero-subtitle">
                Engineered for creators, developers, and teams. Built with cloud-native persistence, MariaDB, and authenticated Model Context Protocol (MCP) tool calling.
            </p>
            <div class="urumi-hero-features">
                <span class="urumi-feature-chip">📦 Cash on Delivery (COD) Enabled</span>
                <span class="urumi-feature-chip">🤖 AI Chat Agent Managed</span>
                <span class="urumi-feature-chip">🛡️ 100% Zero-Leak Credentials</span>
            </div>
        </div>
        <?php
    }
});
