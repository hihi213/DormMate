-- Demo 초기화 요청 시 냉장고 데이터를 완전히 재구성한다.

SET TIME ZONE 'UTC';

SELECT public.fn_demo_reset_fridge();
