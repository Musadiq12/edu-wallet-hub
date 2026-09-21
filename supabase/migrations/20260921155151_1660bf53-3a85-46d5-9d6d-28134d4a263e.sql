
-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- taxonomy (future ready: exam -> course -> subject -> product)
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  whats_included TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  course_label TEXT,
  subject_label TEXT,
  keywords TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discounted_price NUMERIC(10,2),
  cover_image TEXT,
  pdf_file TEXT,
  preview_file TEXT,
  page_count INT,
  format TEXT NOT NULL DEFAULT 'PDF',
  is_free BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exams, public.courses, public.subjects, public.categories, public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exams, public.courses, public.subjects, public.categories, public.products TO authenticated;
GRANT ALL ON public.exams, public.courses, public.subjects, public.categories, public.products TO service_role;

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read exams" ON public.exams FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "public read courses" ON public.courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read subjects" ON public.subjects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read active products" ON public.products FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "admin manage exams" ON public.exams FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage courses" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- orders
CREATE TYPE public.payment_status AS ENUM ('pending','submitted','verified','rejected');
CREATE TYPE public.order_status AS ENUM ('pending_payment','payment_submitted','payment_verified','payment_rejected','processing','delivered','cancelled');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_title TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'UPI',
  transaction_id TEXT,
  screenshot_path TEXT,
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  order_status public.order_status NOT NULL DEFAULT 'pending_payment',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND payment_status = 'submitted' AND order_status = 'payment_submitted');
CREATE POLICY "admin update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- contact messages
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can send message" ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin read messages" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete messages" ON public.contact_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- timestamps + profile bootstrap
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, whatsapp)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.raw_user_meta_data->>'whatsapp')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- seed taxonomy + categories + clearly-marked demo products
INSERT INTO public.exams (name, slug, description) VALUES ('IGNOU','ignou','Indira Gandhi National Open University programmes');
INSERT INTO public.categories (name, slug, description, sort_order) VALUES
 ('Notes','notes','Subject-wise notes and revision material.',1),
 ('Guess Papers','guess-papers','Exam-oriented practice and likely-topic guides.',2),
 ('Assignment Guidance','assignment-guidance','Original reference material and explanations.',3),
 ('Exam Guides','exam-guides','Focused preparation and revision resources.',4);

INSERT INTO public.courses (exam_id, code, name, slug)
SELECT id,'BCOMG','B.Com General','bcomg' FROM public.exams WHERE slug='ignou';
INSERT INTO public.courses (exam_id, code, name, slug)
SELECT id,'MCOM','M.Com','mcom' FROM public.exams WHERE slug='ignou';

INSERT INTO public.products (title, slug, description, whats_included, category_id, exam_id, course_label, subject_label, keywords, price, discounted_price, page_count, is_free, is_featured, is_demo)
SELECT 'DEMO — IGNOU Guess Paper (Business Law)','demo-ignou-bcomg-business-law-guess-paper',
 'Demo placeholder resource. Exam-focused important topics and practice questions designed to support revision.',
 'Important topics list, practice questions, revision checklist',
 (SELECT id FROM public.categories WHERE slug='guess-papers'), (SELECT id FROM public.exams WHERE slug='ignou'),
 'BCOMG','Business Law','BCOMG business law guess paper ignou',80,40,24,false,true,true;

INSERT INTO public.products (title, slug, description, whats_included, category_id, exam_id, course_label, subject_label, keywords, price, discounted_price, page_count, is_free, is_featured, is_demo)
SELECT 'DEMO — IGNOU Assignment Reference (Economics)','demo-ignou-mcom-economics-assignment-reference',
 'Demo placeholder resource. Original reference material and explanations designed to help students understand assignment questions.',
 'Question-wise explanations, reference points, formatting guidance',
 (SELECT id FROM public.categories WHERE slug='assignment-guidance'), (SELECT id FROM public.exams WHERE slug='ignou'),
 'MCOM','Economics','MCO economics assignment reference ignou',167,100,36,false,true,true;

INSERT INTO public.products (title, slug, description, whats_included, category_id, exam_id, course_label, subject_label, keywords, price, discounted_price, page_count, is_free, is_featured, is_demo)
SELECT 'DEMO — Free Sample Notes (Accountancy)','demo-free-sample-notes-accountancy',
 'Demo placeholder free sample. A short set of notes so students can see the format before purchasing.',
 'Sample notes extract, formatting preview',
 (SELECT id FROM public.categories WHERE slug='notes'), (SELECT id FROM public.exams WHERE slug='ignou'),
 'BCOMG','Accountancy','BCOMG accountancy notes free sample',0,NULL,8,true,false,true;
