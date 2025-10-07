import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const config = {
  api: { bodyparser: false },
};

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe disabled (missing keys)" },
      { status: 501 }
    );
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    const handlePaymentIntent = async (paymentIntentId, isPaid) => {
      const session = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
      });

      const first = session.data && session.data[0];
      const meta = first && first.metadata;
      if (!meta || meta.appId !== "gocart" || !meta.orderIds || !meta.userId) {
        return NextResponse.json({ received: true, message: "Invalid metadata" });
      }

      const orderIdsArray = meta.orderIds.split(",");

      if (isPaid) {
        await Promise.all(
          orderIdsArray.map((orderId) =>
            prisma.order.update({
              where: { id: orderId },
              data: { isPaid: true },
            })
          )
        );
        await prisma.user.update({
          where: { id: meta.userId },
          data: { cart: {} },
        });
      } else {
        await Promise.all(
          orderIdsArray.map((orderId) =>
            prisma.order.delete({
              where: { id: orderId },
            })
          )
        );
      }
    };

    switch (event.type) {
      case "payment_intent.succeeded": {
        await handlePaymentIntent(event.data.object.id, true);
        break;
      }
      case "payment_intent.canceled": {
        await handlePaymentIntent(event.data.object.id, false);
        break;
      }
      default:
        console.log("Unhandled event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
