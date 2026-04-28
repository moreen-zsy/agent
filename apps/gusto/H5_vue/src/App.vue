<template>
  <div class="relative min-h-screen bg-[#0A0A0A]">
    <WebGLBackground />
    <Header />
    <CartSidebar />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import WebGLBackground from '@/components/WebGLBackground.vue';
import Header from '@/components/Header.vue';
import CartSidebar from '@/components/CartSidebar.vue';
</script>
