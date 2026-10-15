import axios, { AxiosInstance } from 'axios';

export interface WooCommerceConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  timeoutMs?: number;
}

export class WooCommerceClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(config: WooCommerceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.client = axios.create({
      baseURL: `${this.baseUrl}/wp-json/wc/v3`,
      auth: {
        username: config.consumerKey,
        password: config.consumerSecret,
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WooCommerce-MCP-Server/1.0',
      },
      timeout: config.timeoutMs || 10000,
    });
  }

  async listProducts(params?: {
    search?: string;
    per_page?: number;
    page?: number;
    status?: string;
    category?: string;
  }) {
    try {
      const response = await this.client.get('/products', { params });
      return response.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        price: p.price,
        regular_price: p.regular_price,
        sale_price: p.sale_price,
        stock_status: p.stock_status,
        stock_quantity: p.stock_quantity,
        short_description: p.short_description?.replace(/<[^>]*>?/gm, '').trim(),
        categories: p.categories?.map((c: any) => c.name),
        permalink: p.permalink,
      }));
    } catch (error: any) {
      throw new Error(`Failed to list products: ${error.response?.data?.message || error.message}`);
    }
  }

  async createProduct(data: {
    name: string;
    regular_price: string;
    description?: string;
    short_description?: string;
    stock_quantity?: number;
    manage_stock?: boolean;
    status?: string;
  }) {
    try {
      const payload: any = {
        name: data.name,
        type: 'simple',
        regular_price: String(data.regular_price),
        status: data.status || 'publish',
      };
      if (data.description) payload.description = data.description;
      if (data.short_description) payload.short_description = data.short_description;
      if (data.stock_quantity !== undefined) {
        payload.manage_stock = true;
        payload.stock_quantity = data.stock_quantity;
      }

      const response = await this.client.post('/products', payload);
      const p = response.data;
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        regular_price: p.regular_price,
        status: p.status,
        stock_quantity: p.stock_quantity,
        permalink: p.permalink,
        message: `Product '${p.name}' created successfully with ID ${p.id}`,
      };
    } catch (error: any) {
      throw new Error(`Failed to create product: ${error.response?.data?.message || error.message}`);
    }
  }

  async listOrders(params?: {
    per_page?: number;
    page?: number;
    status?: string;
    after?: string;
    before?: string;
  }) {
    try {
      const response = await this.client.get('/orders', { params });
      return response.data.map((o: any) => ({
        id: o.id,
        status: o.status,
        currency: o.currency,
        date_created: o.date_created,
        total: o.total,
        customer_name: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || 'Guest',
        billing_email: o.billing?.email,
        items_count: o.line_items?.length || 0,
        items: o.line_items?.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          total: item.total,
        })),
        payment_method_title: o.payment_method_title,
      }));
    } catch (error: any) {
      throw new Error(`Failed to list orders: ${error.response?.data?.message || error.message}`);
    }
  }

  async getOrder(orderId: number | string) {
    try {
      const response = await this.client.get(`/orders/${orderId}`);
      const o = response.data;
      return {
        id: o.id,
        status: o.status,
        currency: o.currency,
        date_created: o.date_created,
        total: o.total,
        total_tax: o.total_tax,
        shipping_total: o.shipping_total,
        customer_name: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || 'Guest',
        billing: {
          first_name: o.billing?.first_name,
          last_name: o.billing?.last_name,
          address_1: o.billing?.address_1,
          city: o.billing?.city,
          state: o.billing?.state,
          postcode: o.billing?.postcode,
          country: o.billing?.country,
          email: o.billing?.email,
          phone: o.billing?.phone,
        },
        shipping: {
          first_name: o.shipping?.first_name,
          last_name: o.shipping?.last_name,
          address_1: o.shipping?.address_1,
          city: o.shipping?.city,
          state: o.shipping?.state,
          postcode: o.shipping?.postcode,
          country: o.shipping?.country,
        },
        payment_method: o.payment_method,
        payment_method_title: o.payment_method_title,
        line_items: o.line_items?.map((i: any) => ({
          id: i.id,
          name: i.name,
          product_id: i.product_id,
          quantity: i.quantity,
          subtotal: i.subtotal,
          total: i.total,
          price: i.price,
        })),
      };
    } catch (error: any) {
      throw new Error(`Failed to get order #${orderId}: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateOrderStatus(orderId: number | string, status: string) {
    try {
      const validStatuses = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];
      const normalizedStatus = status.toLowerCase().replace(/_/g, '-');
      if (!validStatuses.includes(normalizedStatus)) {
        throw new Error(`Invalid status '${status}'. Allowed statuses: ${validStatuses.join(', ')}`);
      }

      const response = await this.client.put(`/orders/${orderId}`, {
        status: normalizedStatus,
      });
      const o = response.data;
      return {
        id: o.id,
        status: o.status,
        date_modified: o.date_modified,
        message: `Order #${o.id} status successfully updated to '${o.status}'`,
      };
    } catch (error: any) {
      throw new Error(`Failed to update order #${orderId}: ${error.response?.data?.message || error.message}`);
    }
  }
}
