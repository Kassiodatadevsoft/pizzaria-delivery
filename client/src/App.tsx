import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Checkout from "./pages/Checkout";
import OrderTracking from "./pages/OrderTracking";
import MyOrders from "./pages/MyOrders";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminDelivery from "./pages/admin/AdminDelivery";
import AdminMenu from "./pages/admin/AdminMenu";
import ShareLink from "./pages/ShareLink";
import AdminApiKeys from "./pages/admin/AdminApiKeys";
import Navbar from "./components/Navbar";
import CartDrawer from "./components/CartDrawer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cardapio" component={Menu} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/pedido/:token" component={OrderTracking} />
      <Route path="/meus-pedidos" component={MyOrders} />
      <Route path="/admin" component={() => <AdminLayout><AdminOrders /></AdminLayout>} />
      <Route path="/admin/pedidos" component={() => <AdminLayout><AdminOrders /></AdminLayout>} />
      <Route path="/admin/delivery" component={() => <AdminLayout><AdminDelivery /></AdminLayout>} />
      <Route path="/admin/cardapio" component={() => <AdminLayout><AdminMenu /></AdminLayout>} />
      <Route path="/admin/compartilhar" component={() => <AdminLayout><ShareLink /></AdminLayout>} />
      <Route path="/admin/api-keys" component={() => <AdminLayout><AdminApiKeys /></AdminLayout>} />
      <Route path="/compartilhar" component={ShareLink} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <CartProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <Navbar />
            <CartDrawer />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
