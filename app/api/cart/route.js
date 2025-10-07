import prisma from "@/lib/prisma";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Get user cart 
export async function GET(request){
    try {
        const { userId } = getAuth(request);
        
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return NextResponse.json({ cart: [] }, { status: 200 });
        }

        return NextResponse.json({ cart: user.cart || [] });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

// Update user cart 
export async function POST(request){
    try {
        const { userId } = getAuth(request);
        
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const { cart } = await request.json();

        await prisma.user.update({
            where: { id: userId },
            data: { cart: cart }
        });

        return NextResponse.json({ message: 'Cart updated' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
